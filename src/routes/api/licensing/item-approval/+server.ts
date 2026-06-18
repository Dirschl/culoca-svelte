import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createAuthedSupabaseFromRequest, requireAuthedUser } from '$lib/server/authedSupabase';
import { isLicenseCurator } from '$lib/licensing/curator';
import { getCreatorLicensingOptIn } from '$lib/server/licensingSale';
import {
	enrichItemWithResolvedAdobeStock,
	setCulocaInStockSettings
} from '$lib/stock/itemStockSettings';

export const POST: RequestHandler = async ({ request }) => {
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);

	if (!isLicenseCurator(user.id)) {
		throw error(403, 'Nur der Culoca-Lizenz-Kurator darf Verkaufsfreigaben setzen.');
	}

	const body = await request.json().catch(() => ({}));
	const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
	const saleApproved = body?.saleApproved === true;

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

	if (saleApproved) {
		const optIn = await getCreatorLicensingOptIn(supabase, item.profile_id);
		if (!optIn) {
			throw error(
				409,
				'Der Ersteller hat dem Culoca-Lizenzverkauf noch nicht zugestimmt. Bitte zuerst Opt-in abwarten.'
			);
		}
	}

	const now = new Date().toISOString();
	const stock_settings = setCulocaInStockSettings(item.stock_settings, {
		saleApproved,
		saleApprovedAt: saleApproved ? now : null,
		saleApprovedBy: saleApproved ? user.id : null
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

	return json({
		ok: true,
		item: enrichItemWithResolvedAdobeStock(updated as Record<string, unknown>),
		message: saleApproved
			? 'Bild für Culoca-Lizenzverkauf freigegeben.'
			: 'Verkaufsfreigabe für dieses Bild entfernt.'
	});
};
