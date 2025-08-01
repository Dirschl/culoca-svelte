import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Admin-Key!
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

async function migrateSlugs() {
  const { data: items, error } = await supabase
    .from('items')
    .select('id, title, original_name, slug, profile_id')
    .or('slug.is.null,slug.eq.""');

  if (error) throw error;

  for (const item of items) {
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
    // Slug-Basis auf 95 Zeichen kürzen, damit für -2, -3 etc. Platz bleibt
    let base = slugify(`${item.title || item.original_name || item.id}-${creator}`).substring(0, 95);
    let slug = base;
    let counter = 2;
    // Prüfe auf Kollisionen
    while (true) {
      const { data: exists } = await supabase
        .from('items')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${base}-${counter++}`;
      if (slug.length > 100) slug = slug.substring(0, 100);
    }
    // Update
    await supabase
      .from('items')
      .update({ slug })
      .eq('id', item.id);
    console.log(`Set slug for ${item.id}: ${slug}`);
  }
}

migrateSlugs().then(() => console.log('Migration complete!'));