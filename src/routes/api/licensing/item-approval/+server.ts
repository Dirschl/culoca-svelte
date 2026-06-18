import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createAuthedSupabaseFromRequest, requireAuthedUser } from '$lib/server/authedSupabase';
import { isLicenseCurator } from '$lib/licensing/curator';
import { resolveDenialReasonText, type CulocaSaleDenialPresetId } from '$lib/licensing/denialReasons';
import { MANAGE_CULOCA_LICENSING_PERMISSION } from '$lib/licensing/shopApproval';
import {
	getCreatorAutoApprove,
	getCreatorLicensingOptIn,
	userHasPermission
} from '$lib/server/licensingSale';
import {
	enrichItemWithResolvedAdobeStock,
	setCulocaInStockSettings
} from '$lib/stock/itemStockSettings';

const DENIAL_PRESET_IDS = new Set([
	'no_model_release',
	'no_castles',
	'quality',
	'rights_unclear',
	'other'
]);

export const POST: RequestHandler = async ({ request }) => {
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);

	const body = await request.json().catch(() => ({}));
	const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
	const saleApproved = body?.saleApproved === true;
	const saleDenied = body?.saleDenied === true;
	const denialPreset =
		typeof body?.denialPreset === 'string' ? body.denialPreset : '';
	const denialCustomText =
		typeof body?.denialCustomText === 'string' ? body.denialCustomText.trim() : '';

	if (!itemId) {
		throw error(400, 'itemId fehlt');
	}

	const { data: item, error: itemError } = await supabase
		.from('items')
		.select(
			'id, profile_id, stock_settings, adobe_stock_status, adobe_stock_uploaded_at, adobe_stock_asset_id, adobe_stock_url, adobe_stock_error'
		)
		.eq('id', itemId)
		.maybeSingle();

	if (itemError || !item) {
		throw error(404, 'Bild nicht gefunden');
	}

	const isCurator =
		isLicenseCurator(user.id) ||
		(await userHasPermission(supabase, user.id, MANAGE_CULOCA_LICENSING_PERMISSION));
	const isOwner = item.profile_id === user.id;
	const ownerAutoApprove = isOwner && (await getCreatorAutoApprove(supabase, user.id));

	if (!isCurator && !ownerAutoApprove) {
		throw error(
			403,
			'Keine Berechtigung: Nur der Culoca-Lizenz-Kurator oder Ersteller mit Autofreigabe dürfen die Shop-Freigabe setzen.'
		);
	}

	if (saleDenied && !isCurator) {
		throw error(403, 'Nur der Culoca-Lizenz-Kurator darf einen Verkauf mit Begründung ablehnen.');
	}

	if (saleDenied) {
		if (!DENIAL_PRESET_IDS.has(denialPreset)) {
			throw error(400, 'Bitte einen Ablehnungsgrund wählen.');
		}
		if (denialPreset === 'other' && !denialCustomText) {
			throw error(400, 'Bitte einen Freitext für die Ablehnung angeben.');
		}
	}

	if (saleApproved) {
		const optIn = await getCreatorLicensingOptIn(supabase, item.profile_id);
		if (!optIn) {
			throw error(
				409,
				'Der Ersteller hat dem Culoca-Lizenzverkauf noch nicht zugestimmt. Bitte zuerst Opt-in im Profil abwarten.'
			);
		}
	}

	const now = new Date().toISOString();
	const denialReason = saleDenied
		? resolveDenialReasonText(denialPreset as CulocaSaleDenialPresetId, denialCustomText)
		: null;

	const stock_settings = setCulocaInStockSettings(item.stock_settings, {
		saleApproved,
		saleApprovedAt: saleApproved ? now : null,
		saleApprovedBy: saleApproved ? user.id : null,
		saleDenied,
		saleDeniedReason: denialReason,
		saleDeniedAt: saleDenied ? now : null,
		saleDeniedBy: saleDenied ? user.id : null
	});

	const { data: updated, error: updateError } = await supabase
		.from('items')
		.update({ stock_settings })
		.eq('id', itemId)
		.select()
		.single();

	if (updateError) {
		throw error(500, updateError.message);
	}

	let message = 'Verkaufsfreigabe für dieses Bild entfernt.';
	if (saleApproved) {
		message = 'Bild für Culoca-Lizenzverkauf freigegeben.';
	} else if (saleDenied) {
		message = 'Verkauf abgelehnt — der Ersteller sieht die Begründung auf der Bildseite.';
	}

	return json({
		ok: true,
		item: enrichItemWithResolvedAdobeStock(updated as Record<string, unknown>),
		message
	});
};
