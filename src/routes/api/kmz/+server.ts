import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import JSZip from 'jszip';

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

    // Items aus der Datenbank laden (alle 4000+ Items)
    let allItems: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id, title, description, caption, slug, lat, lon, path_64, path_512, created_at, user_id,
          profiles!inner(full_name)
        `)
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
        console.log(`Loaded ${allItems.length} items for KMZ generation...`);
        
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

    console.log(`Found ${items.length} items for KMZ generation`);

    // KMZ erstellen
    const kmzContent = await generateKMZ(items);

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.google-earth.kmz',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive'
    };

    headers['Content-Disposition'] = 'inline; filename="culoca-items.kmz"';

    return new Response(kmzContent, { headers });

  } catch (error) {
    console.error('Error generating KMZ:', error);
    return new Response('Error generating KMZ', { status: 500 });
  }
};

async function generateKMZ(items: any[]): Promise<Uint8Array> {
  const zip = new JSZip();
  
  // KML-Inhalt generieren (ohne Bild-Downloads)
  const kmlContent = await generateKMLWithImages(items, zip);
  zip.file('doc.kml', kmlContent);
  
  console.log('KMZ generated with external image links');
  
  // KMZ als ZIP generieren
  const kmzBuffer = await zip.generateAsync({ type: 'uint8array' });
  return kmzBuffer;
}

async function generateKMLWithImages(items: any[], zip: JSZip): Promise<string> {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Culoca GPS Items</name>
    <description>Alle öffentlichen GPS-Items von Culoca (Mobile-optimiert)</description>
    <open>1</open>
    
    <Style id="culoca-balloon">
      <BalloonStyle>
        <bgColor>ffffffff</bgColor>
        <textColor>ff000000</textColor>
        <text><![CDATA[
          <div style="font-family:system-ui,sans-serif;font-size:14px;padding:10px;">
            $[description]
          </div>
        ]]></text>
      </BalloonStyle>
    </Style>
    
    <Folder>
      <name>📸 Culoca Items (${items.length})</name>
      <description style="color: #999; font-size: 12px;">Aktualisiert: ${new Date().toLocaleDateString('de-DE')} • ${items.length} öffentliche GPS-Items</description>
      <open>1</open>
      `;

  for (const item of items) {
    kml += await generatePlacemarkWithImage(item, zip);
  }

  kml += `
    </Folder>
  </Document>
</kml>`;

  return kml;
}

async function generatePlacemarkWithImage(item: any, zip: JSZip): Promise<string> {
  const title = escapeXml(item.title || 'Ohne Titel');
  const description = escapeXml(item.description || '');
  const caption = escapeXml(item.caption || '');
  const slug = item.slug || item.id;
  const itemUrl = `https://culoca.com/item/${slug}`;
  
  // Koordinaten mit voller Präzision
  const lat = parseFloat(item.lat).toFixed(6);
  const lon = parseFloat(item.lon).toFixed(6);
  
  // 64px Bild als Icon verwenden (externer Link wie in KML)
  const iconUrl = item.path_64 
    ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`
    : 'https://culoca.com/culoca-icon.png';
  
  // Mobile-optimierte Beschreibung für den Balloon (ohne Bilder im Popup)
  const balloonContent = `<![CDATA[
    <div style="font-family: Arial, sans-serif; width: 350px;">
      <h3 style="color: #000; margin-bottom: 10px;">${title}</h3>
      ${description ? `<p style="margin-bottom: 10px;">${description}</p>` : ''}
      ${caption && caption !== title ? `<p style="color: #666; font-style: italic; font-size: 0.9em; margin-bottom: 10px;">${caption}</p>` : ''}
      <p style="font-size: 0.8em; color: #666;"><strong>Koordinaten:</strong> ${lat}, ${lon}</p>
      <p style="font-size: 0.8em; color: #666;"><strong>Erstellt von:</strong> ${item.profiles?.full_name || 'Unbekannt'}</p>
      <p style="font-size: 0.8em; color: #666;"><strong>Erstellt:</strong> ${new Date(item.created_at).toLocaleDateString('de-DE')}</p>
      <p style="margin-top: 15px;"><a href="${itemUrl}" target="_blank" style="background: #ff6600; color: white; padding: 8px 12px; text-decoration: none; border-radius: 4px; font-weight: bold;">Auf Culoca ansehen</a></p>
    </div>
  ]]>`;

  return `
    <Placemark>
      <name>${title}</name>
      <description>${balloonContent}</description>
      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
      <Style>
        <IconStyle>
          <Icon>
            <href>${iconUrl}</href>
          </Icon>
          <scale>1.0</scale>
          <hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/>
        </IconStyle>
        <LabelStyle>
          <scale>0</scale>
        </LabelStyle>
      </Style>
      <styleUrl>#culoca-balloon</styleUrl>
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
