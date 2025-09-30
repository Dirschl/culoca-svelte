import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
  try {
    // Supabase Client erstellen
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response('Server configuration error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Items aus der Datenbank laden
    const { data: items, error } = await supabase
      .from('items')
      .select('id, title, description, slug, lat, lon, path_512, created_at')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .eq('is_private', false)
      .limit(1000);

    if (error) {
      console.error('Database error:', error);
      return new Response('Database error', { status: 500 });
    }

    if (!items || items.length === 0) {
      console.log('No items found');
      return new Response('No items found', { status: 404 });
    }

    console.log(`Found ${items.length} items for KML generation`);

    const kmlContent = generateKML(items);

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.google-earth.kml+xml',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    // For direct opening in Google Earth, always inline
    headers['Content-Disposition'] = 'inline; filename="culoca-items.kml"';

    return new Response(kmlContent, { headers });

  } catch (error) {
    console.error('Error generating KML:', error);
    return new Response('Error generating KML', { status: 500 });
  }
};

function generateKML(items: any[]): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Culoca GPS Items</name>
    <description>Alle öffentlichen GPS-Items von Culoca</description>
    <open>1</open>
    
    <Style id="culoca-style">
      <IconStyle>
        <Icon>
          <href>https://culoca.com/culoca-icon.png</href>
        </Icon>
        <scale>1.0</scale>
      </IconStyle>
    </Style>
    
    <Folder>
      <name>📸 Culoca Items (${items.length})</name>
      <description>GPS-gebundene Fotos und Bilder</description>
      <open>1</open>
      `;

  items.forEach(item => {
    kml += generatePlacemark(item);
  });

  kml += `
    </Folder>
  </Document>
</kml>`;

  return kml;
}

function generatePlacemark(item: any): string {
  const title = escapeXml(item.title || 'Ohne Titel');
  const description = escapeXml(item.description || '');
  const slug = item.slug || item.id;
  const itemUrl = `https://culoca.com/item/${slug}`;
  
  // Koordinaten mit voller Präzision
  const lat = parseFloat(item.lat).toFixed(6);
  const lon = parseFloat(item.lon).toFixed(6);
  
  let descriptionHtml = `<![CDATA[
    <div style="font-family: Arial, sans-serif; max-width: 400px;">
      <h3>${title}</h3>
      <p>${description}</p>
      <p><strong>📍 Koordinaten:</strong> ${lat}, ${lon}</p>
      <p><strong>🔗 Link:</strong> <a href="${itemUrl}" target="_blank">${itemUrl}</a></p>
      <p><strong>📅 Erstellt:</strong> ${new Date(item.created_at).toLocaleDateString('de-DE')}</p>
  `;
  
  // Bild hinzufügen falls vorhanden
  if (item.path_512) {
    const imageUrl = `https://culoca.com/storage/v1/object/public/512px/${item.path_512}`;
    descriptionHtml += `<p><strong>🖼️ Bild:</strong></p><img src="${imageUrl}" style="max-width: 300px; height: auto;" alt="${title}" /></p>`;
  }
  
  descriptionHtml += `</div>]]>`;

  return `
    <Placemark>
      <name>${title}</name>
      <description>${descriptionHtml}</description>
      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
      <styleUrl>#culoca-style</styleUrl>
    </Placemark>
    `;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}