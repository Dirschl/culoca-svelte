import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { createClient } from 'webdav';
import { slugifySegment } from '$lib/content/routing';
import { sanitizeContentHtml } from '$lib/content/html';
import { sanitizeKeywords } from '$lib/content/keywords';
import { normalizeGeoDraft } from '$lib/content/locationTaxonomy';
import {
  refreshSimilarityVectorForItem,
  resolveLocationFieldsFromOriginalName
} from '$lib/server/itemProcessing';
import {
  buildAdobeDualWrite,
  enrichItemWithResolvedAdobeStock,
  getAdobeStockStateFromItem
} from '$lib/stock/itemStockSettings';

export const DELETE = async ({ params }) => {
  const { id } = params;
  if (!id) {
    throw error(400, 'Missing id');
  }

  const { count: childCount, error: childCountError } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('group_root_item_id', id);

  if (childCountError) {
    throw error(500, childCountError.message);
  }

  if ((childCount || 0) > 0) {
    return json(
      {
        success: false,
        error: 'Dieses Root-Item hat noch untergeordnete Inhalte. Bitte zuerst Gruppe auflösen, neues Root wählen oder die ganze Gruppe kontrolliert löschen.'
      },
      { status: 409 }
    );
  }

  // 1. Hole Item aus DB
  const { data: item, error: fetchError } = await supabase
    .from('items')
    .select('id, path_512, path_2048, path_64, original_url')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    throw error(404, 'Item not found');
  }

  // 2. Lösche Bilder aus Supabase Storage
  const filesToDelete = [];
  if (item.path_512) filesToDelete.push(item.path_512);
  if (item.path_2048) filesToDelete.push(item.path_2048);
  if (item.path_64) filesToDelete.push(item.path_64);

  if (filesToDelete.length > 0) {
    await supabase.storage.from('images-512').remove([item.path_512]);
    await supabase.storage.from('images-2048').remove([item.path_2048]);
    await supabase.storage.from('images-64').remove([item.path_64]);
  }

  // 3. Lösche Original von Hetzner (WebDAV)
  let hetznerDeleted = false;
  if (item.original_url) {
    try {
      const webdav = createClient(
        process.env.HETZNER_WEBDAV_URL!,
        {
          username: process.env.HETZNER_WEBDAV_USER!,
          password: process.env.HETZNER_WEBDAV_PASSWORD!
        }
      );
      // Extrahiere Pfad aus URL
      const url = new URL(item.original_url);
      const hetznerPath = url.pathname;
      await webdav.deleteFile(hetznerPath);
      hetznerDeleted = true;
    } catch (e) {
      hetznerDeleted = false;
    }
  }

  // 4. Lösche DB-Eintrag
  const { error: deleteError } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw error(500, 'Failed to delete item from database');
  }

  return json({ success: true, hetznerDeleted });
};

type ItemRecord = {
  group_slug?: string | null;
  page_settings?: Record<string, unknown> | null;
  stock_settings?: Record<string, unknown> | null;
  adobe_stock_status?: string | null;
  adobe_stock_uploaded_at?: string | null;
  adobe_stock_asset_id?: string | null;
  adobe_stock_url?: string | null;
  adobe_stock_error?: string | null;
  content?: string | null;
  country_code?: string | null;
  country_slug?: string | null;
  state_slug?: string | null;
  region_slug?: string | null;
  district_code?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
  country_name?: string | null;
  state_name?: string | null;
  region_name?: string | null;
  district_name?: string | null;
  municipality_name?: string | null;
  locality_name?: string | null;
};

function hasCompleteGeoFields(source: Record<string, unknown> | ItemRecord | null | undefined) {
  return !!(
    typeof source?.country_slug === 'string' &&
    source.country_slug.trim() &&
    typeof source?.district_slug === 'string' &&
    source.district_slug.trim() &&
    typeof source?.municipality_slug === 'string' &&
    source.municipality_slug.trim()
  );
}

export const PATCH = async ({ params, request }) => {
  const { id } = params;
  if (!id) {
    throw error(400, 'Missing id');
  }

  // Parse JSON body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (e) {
    throw error(400, 'Invalid JSON');
  }

  // Erlaubte Felder
  const allowedFields = [
    'title',
    'description',
    'caption',
    'keywords',
    'original_name',
    'gallery',
    'lat',
    'lon',
    'slug',
    'content',
    'group_root_item_id',
    'group_slug',
    'sort_order',
    'show_in_main_feed',
    'canonical_path',
    'starts_at',
    'ends_at',
    'external_url',
    'video_url',
    'page_settings',
    'type_id',
    'country_code',
    'country_name',
    'country_slug',
    'state_name',
    'state_slug',
    'region_name',
    'region_slug',
    'district_code',
    'district_name',
    'district_slug',
    'municipality_name',
    'municipality_slug',
    'locality_name',
    'location_source',
    'location_confidence',
    'location_needs_review',
    'taxonomy_slug_suffix',
    'adobe_stock_status',
    'adobe_stock_uploaded_at',
    'adobe_stock_asset_id',
    'adobe_stock_url',
    'adobe_stock_error'
  ];
  const updateData: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updateData[key] = body[key];
    }
  }
  if (Object.keys(updateData).length === 0) {
    throw error(400, 'No valid fields to update');
  }

  if (updateData.group_slug !== undefined) {
    const normalizedGroupSlug =
      typeof updateData.group_slug === 'string' ? slugifySegment(updateData.group_slug) : updateData.group_slug;
    updateData.group_slug = normalizedGroupSlug || null;

    if (normalizedGroupSlug) {
      const { data: existingGroupSlug, error: groupSlugError } = await supabase
        .from('items')
        .select('id')
        .ilike('group_slug', String(normalizedGroupSlug))
        .neq('id', id)
        .limit(1)
        .maybeSingle();

      if (groupSlugError) {
        throw error(500, groupSlugError.message);
      }

      if (existingGroupSlug) {
        throw error(409, 'Group slug already exists. Please choose a different group slug.');
      }
    }
  }

  if (updateData.page_settings !== undefined) {
    if (updateData.page_settings === null) {
      updateData.page_settings = {};
    } else if (
      typeof updateData.page_settings !== 'object' ||
      Array.isArray(updateData.page_settings)
    ) {
      throw error(400, 'page_settings must be an object');
    }
  }

  if (updateData.content !== undefined) {
    updateData.content =
      typeof updateData.content === 'string'
        ? sanitizeContentHtml(updateData.content)
        : updateData.content;
  }

  const { data: existingItem, error: existingItemError } = await supabase
    .from('items')
    .select(
      'group_slug, page_settings, stock_settings, content, country_code, country_slug, state_slug, region_slug, district_code, district_slug, municipality_slug, country_name, state_name, region_name, district_name, municipality_name, locality_name, adobe_stock_status, adobe_stock_uploaded_at, adobe_stock_asset_id, adobe_stock_url, adobe_stock_error'
    )
    .eq('id', id)
    .single<ItemRecord>();

  if (existingItemError || !existingItem) {
    throw error(404, 'Item not found');
  }

  if (updateData.keywords !== undefined) {
    updateData.keywords = sanitizeKeywords(
      Array.isArray(updateData.keywords) ? updateData.keywords : String(updateData.keywords || ''),
      {
        countryName: typeof body.country_name === 'string' ? body.country_name : existingItem.country_name,
        stateName: typeof body.state_name === 'string' ? body.state_name : existingItem.state_name,
        regionName: typeof body.region_name === 'string' ? body.region_name : existingItem.region_name,
        districtName: typeof body.district_name === 'string' ? body.district_name : existingItem.district_name,
        municipalityName: typeof body.municipality_name === 'string' ? body.municipality_name : existingItem.municipality_name,
        localityName: existingItem.locality_name
      }
    );
  }

  if (typeof updateData.original_name === 'string') {
    const locationFields = await resolveLocationFieldsFromOriginalName(supabase, updateData.original_name);

    if (locationFields) {
      Object.assign(updateData, locationFields);
    } else {
      const mergedGeo = {
        country_slug: typeof updateData.country_slug === 'string' ? updateData.country_slug : existingItem.country_slug,
        district_slug: typeof updateData.district_slug === 'string' ? updateData.district_slug : existingItem.district_slug,
        municipality_slug:
          typeof updateData.municipality_slug === 'string' ? updateData.municipality_slug : existingItem.municipality_slug
      };
      updateData.location_needs_review = !hasCompleteGeoFields(mergedGeo);
    }
  }

  const geoFieldsTouched = [
    'country_name',
    'country_slug',
    'state_name',
    'state_slug',
    'region_name',
    'region_slug',
    'district_name',
    'district_slug',
    'municipality_name',
    'municipality_slug'
  ].some((key) => body[key] !== undefined);

  if (geoFieldsTouched) {
    const normalizedGeo = normalizeGeoDraft({
      countryCode: typeof updateData.country_code === 'string' ? updateData.country_code : existingItem.country_code,
      countryName: typeof updateData.country_name === 'string' ? updateData.country_name : existingItem.country_name,
      countrySlug: typeof updateData.country_slug === 'string' ? updateData.country_slug : existingItem.country_slug,
      districtCode: typeof updateData.district_code === 'string' ? updateData.district_code : existingItem.district_code,
      districtName: typeof updateData.district_name === 'string' ? updateData.district_name : existingItem.district_name,
      districtSlug: typeof updateData.district_slug === 'string' ? updateData.district_slug : existingItem.district_slug,
      municipalityName:
        typeof updateData.municipality_name === 'string'
          ? updateData.municipality_name
          : existingItem.municipality_name,
      municipalitySlug:
        typeof updateData.municipality_slug === 'string'
          ? updateData.municipality_slug
          : existingItem.municipality_slug,
      localityName:
        typeof updateData.locality_name === 'string' ? updateData.locality_name : existingItem.locality_name
    });

    if (normalizedGeo) {
      updateData.country_code = normalizedGeo.countryCode;
      updateData.country_name = normalizedGeo.countryName;
      updateData.country_slug = normalizedGeo.countrySlug;
      updateData.state_name = normalizedGeo.stateName;
      updateData.state_slug = normalizedGeo.stateSlug;
      updateData.region_name = normalizedGeo.regionName;
      updateData.region_slug = normalizedGeo.regionSlug;
      updateData.district_code = normalizedGeo.districtCode;
      updateData.district_name = normalizedGeo.districtName;
      updateData.district_slug = normalizedGeo.districtSlug;
      updateData.municipality_name = normalizedGeo.municipalityName;
      updateData.municipality_slug = normalizedGeo.municipalitySlug;
      updateData.locality_name = normalizedGeo.localityName;
      updateData.location_source = 'manual';
      updateData.location_confidence = normalizedGeo.hasKnownAdministrativeHierarchy ? 1 : 0.35;
      updateData.location_needs_review = normalizedGeo.locationNeedsReview;
      updateData.taxonomy_slug_suffix = normalizedGeo.taxonomySlugSuffix;
    }
  }

  const mergedGeoState = {
    country_code:
      typeof updateData.country_code === 'string' ? updateData.country_code : existingItem.country_code ?? null,
    country_name: typeof updateData.country_name === 'string' ? updateData.country_name : existingItem.country_name,
    country_slug: typeof updateData.country_slug === 'string' ? updateData.country_slug : existingItem.country_slug,
    state_name: typeof updateData.state_name === 'string' ? updateData.state_name : existingItem.state_name,
    state_slug: typeof updateData.state_slug === 'string' ? updateData.state_slug : existingItem.state_slug ?? null,
    region_name: typeof updateData.region_name === 'string' ? updateData.region_name : existingItem.region_name,
    region_slug:
      typeof updateData.region_slug === 'string' ? updateData.region_slug : existingItem.region_slug ?? null,
    district_code:
      typeof updateData.district_code === 'string' ? updateData.district_code : existingItem.district_code ?? null,
    district_slug:
      typeof updateData.district_slug === 'string' ? updateData.district_slug : existingItem.district_slug,
    district_name: typeof updateData.district_name === 'string' ? updateData.district_name : existingItem.district_name,
    municipality_name:
      typeof updateData.municipality_name === 'string' ? updateData.municipality_name : existingItem.municipality_name,
    municipality_slug:
      typeof updateData.municipality_slug === 'string' ? updateData.municipality_slug : existingItem.municipality_slug
  };

  const normalizedMergedGeo = normalizeGeoDraft({
    countryCode: mergedGeoState.country_code,
    countryName: mergedGeoState.country_name,
    countrySlug: mergedGeoState.country_slug,
    districtCode: mergedGeoState.district_code,
    districtName: mergedGeoState.district_name,
    districtSlug: mergedGeoState.district_slug,
    municipalityName: mergedGeoState.municipality_name,
    municipalitySlug: mergedGeoState.municipality_slug,
    localityName:
      typeof updateData.locality_name === 'string' ? updateData.locality_name : existingItem.locality_name
  });

  if (normalizedMergedGeo) {
    updateData.country_code = updateData.country_code ?? normalizedMergedGeo.countryCode;
    updateData.country_name = updateData.country_name ?? normalizedMergedGeo.countryName;
    updateData.country_slug = updateData.country_slug ?? normalizedMergedGeo.countrySlug;
    updateData.state_name = updateData.state_name ?? normalizedMergedGeo.stateName;
    updateData.state_slug = updateData.state_slug ?? normalizedMergedGeo.stateSlug;
    updateData.region_name = updateData.region_name ?? normalizedMergedGeo.regionName;
    updateData.region_slug = updateData.region_slug ?? normalizedMergedGeo.regionSlug;
    updateData.district_name = updateData.district_name ?? normalizedMergedGeo.districtName;
    updateData.district_slug = updateData.district_slug ?? normalizedMergedGeo.districtSlug;
    updateData.municipality_name = updateData.municipality_name ?? normalizedMergedGeo.municipalityName;
    updateData.municipality_slug = updateData.municipality_slug ?? normalizedMergedGeo.municipalitySlug;
    updateData.taxonomy_slug_suffix = updateData.taxonomy_slug_suffix ?? normalizedMergedGeo.taxonomySlugSuffix;
    updateData.location_needs_review = normalizedMergedGeo.locationNeedsReview;
  } else if (hasCompleteGeoFields(mergedGeoState)) {
    updateData.location_needs_review = false;
  }

  const adobePatchKeys = [
    'adobe_stock_status',
    'adobe_stock_uploaded_at',
    'adobe_stock_asset_id',
    'adobe_stock_url',
    'adobe_stock_error'
  ] as const;
  if (adobePatchKeys.some((k) => updateData[k] !== undefined)) {
    const mergedPreview = { ...existingItem, ...updateData } as Record<string, unknown>;
    const next = getAdobeStockStateFromItem(mergedPreview);
    const dual = buildAdobeDualWrite(existingItem.stock_settings, next);
    Object.assign(updateData, dual);
  }

  // Optional: Authentifizierung und Besitz prüfen (hier nur als Beispiel, ggf. anpassen)
  // const user = locals.user; // oder aus JWT, falls vorhanden
  // const { data: item } = await supabase.from('items').select('profile_id').eq('id', id).single();
  // if (!item || item.profile_id !== user.id) throw error(403, 'Not allowed');

  // Update in DB
  const { data, error: updateError } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('Database update error:', updateError);
    
    // Spezielle Behandlung für Slug-Konflikte
    if (updateError.code === '23505' && updateError.message.includes('group_slug')) {
      throw error(409, 'Group slug already exists. Please choose a different group slug.');
    }

    if (updateError.code === '23505' && updateError.message.includes('slug')) {
      throw error(409, 'Slug already exists. Please choose a different slug.');
    }
    
    throw error(500, updateError.message);
  }

  try {
    await refreshSimilarityVectorForItem(data as any);
  } catch (vectorError) {
    console.warn('Failed to refresh similarity vector after item update:', vectorError);
  }

  return json({
    success: true,
    item: enrichItemWithResolvedAdobeStock(data as Record<string, unknown>)
  });
}; 
