import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Admin-Key!
  {
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js/2.x'
      }
    }
  }
);

// Verbesserte Slugify-Funktion für deutsche Umlaute und bessere SEO
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    // Deutsche Umlaute korrekt ersetzen
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Weitere europäische Zeichen
    .replace(/à/g, 'a')
    .replace(/á/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ã/g, 'a')
    .replace(/å/g, 'a')
    .replace(/è/g, 'e')
    .replace(/é/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/ë/g, 'e')
    .replace(/ì/g, 'i')
    .replace(/í/g, 'i')
    .replace(/î/g, 'i')
    .replace(/ï/g, 'i')
    .replace(/ò/g, 'o')
    .replace(/ó/g, 'o')
    .replace(/ô/g, 'o')
    .replace(/õ/g, 'o')
    .replace(/ù/g, 'u')
    .replace(/ú/g, 'u')
    .replace(/û/g, 'u')
    .replace(/ý/g, 'y')
    .replace(/ÿ/g, 'y')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c')
    // Unicode-Normalisierung für verbleibende Zeichen
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Nur erlaubte Zeichen behalten
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

async function migrateSlugsWithUmlauts() {
  console.log('🔄 Starte Migration der Slugs mit Umlaut-Behandlung...');
  
  let allItems = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  // Alle Items in Batches laden
  while (hasMore) {
    const { data: items, error } = await supabase
      .from('items')
      .select('id, title, original_name, slug, profile_id')
      .not('slug', 'is', null)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Fehler beim Laden der Items:', error);
      return;
    }

    if (items && items.length > 0) {
      allItems = allItems.concat(items);
      console.log(`📥 Batch geladen: ${items.length} Items (Offset: ${offset})`);
      offset += batchSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`📊 Insgesamt ${allItems.length} Items gefunden`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of allItems) {
    // Lade Erstellername
    let creator = 'user';
    if (item.profile_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('accountname, full_name')
        .eq('id', item.profile_id)
        .maybeSingle();
      creator = profile?.full_name || profile?.accountname || 'user';
    }

    // Generiere neuen Slug mit Umlaut-Behandlung
    const title = item.title || item.original_name || item.id;
    const newSlugBase = slugify(`${title}-${creator}`).substring(0, 95);
    let newSlug = newSlugBase;
    let counter = 2;

    // Prüfe auf Kollisionen
    while (true) {
      const { data: exists } = await supabase
        .from('items')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', item.id) // Ignoriere das aktuelle Item
        .maybeSingle();
      if (!exists) break;
      newSlug = `${newSlugBase}-${counter++}`;
      if (newSlug.length > 100) newSlug = newSlug.substring(0, 100);
    }

    // Vergleiche alten und neuen Slug
    if (item.slug !== newSlug) {
      console.log(`🔄 Update: ${item.id}`);
      console.log(`   Alt: ${item.slug}`);
      console.log(`   Neu: ${newSlug}`);
      
      // Update
      const { error: updateError } = await supabase
        .from('items')
        .update({ slug: newSlug })
        .eq('id', item.id);
      
      if (updateError) {
        console.error(`❌ Fehler beim Update von ${item.id}:`, updateError);
      } else {
        updatedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`✅ Migration abgeschlossen!`);
  console.log(`   Aktualisiert: ${updatedCount}`);
  console.log(`   Übersprungen: ${skippedCount}`);
  console.log(`   Gesamt: ${allItems.length}`);
}

migrateSlugsWithUmlauts().catch(console.error); 