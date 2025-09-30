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

    // Items aus der Datenbank laden mit Pagination (alle 4000+ Items)
    let allItems: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: items, error } = await supabase
        .from('items')
        .select('id, title, description, caption, slug, lat, lon, path_64, path_512, created_at')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .eq('is_private', false)
        .eq('gallery', true)
        .range(offset, offset + pageSize - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        return new Response('Database error', { status: 500 });
      }

      if (!items || items.length === 0) {
        hasMore = false;
      } else {
        allItems.push(...items);
        offset += pageSize;
        console.log(`Loaded ${allItems.length} items so far...`);
        
        // Wenn weniger als pageSize Items zurückkommen, sind wir am Ende
        if (items.length < pageSize) {
          hasMore = false;
        }
      }
    }

    const items = allItems;

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
  const caption = escapeXml(item.caption || '');
  const slug = item.slug || item.id;
  const itemUrl = `https://culoca.com/item/${slug}`;
  
  // Koordinaten mit voller Präzision
  const lat = parseFloat(item.lat).toFixed(6);
  const lon = parseFloat(item.lon).toFixed(6);
  
  // 64px Bild als Icon verwenden (auf 32x32px skaliert), Fallback auf Standard-Icon
  const iconUrl = item.path_64 
    ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`
    : 'https://culoca.com/culoca-icon.png';
  
  let descriptionHtml = `<![CDATA[
    <div style="font-family: Arial, sans-serif; max-width: 400px;">
      <h3>${title}</h3>`;
  
  // Description nur hinzufügen wenn vorhanden (Caption wird nicht angezeigt)
  if (description) {
    descriptionHtml += `<p>${description}</p>`;
  }
  
  descriptionHtml += `
      <p><strong>📍 Koordinaten:</strong> ${lat}, ${lon}</p>
      <p><strong>🔗 Link:</strong> <a href="${itemUrl}" target="_blank">Auf Culoca ansehen</a></p>
      <p><strong>📅 Erstellt:</strong> ${new Date(item.created_at).toLocaleDateString('de-DE')}</p>
  `;
  
  // 64px Bild direkt in der Beschreibung anzeigen (kleiner)
  if (item.path_64) {
    const imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`;
    descriptionHtml += `<p><img src="${imageUrl}" style="width: 64px; height: 64px; border-radius: 8px; margin-top: 10px;" alt="${title}" /></p>`;
  }
  
  descriptionHtml += `</div>]]>`;

  return `
    <Placemark>
      <name>${title}</name>
      <description>${descriptionHtml}</description>
      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
      <Style>
        <IconStyle>
          <Icon>
            <href>${iconUrl}</href>
          </Icon>
          <scale>0.5</scale>
          <hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/>
        </IconStyle>
        <LabelStyle>
          <scale>0</scale>
        </LabelStyle>
      </Style>
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