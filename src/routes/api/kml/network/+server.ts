import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    // Network Link KML - kleines Starter-File
    const networkKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Culoca GPS Items (Live)</name>
    <description>Network Link für automatische Updates aller Culoca GPS-Items</description>
    <open>1</open>
    
    <NetworkLink>
      <name>Culoca Items - Live Feed</name>
      <description>Lädt alle öffentlichen GPS-Items von Culoca mit 5-Minuten Auto-Update</description>
      <Link>
        <href>https://culoca.com/api/kml</href>
        <refreshMode>onInterval</refreshMode>
        <refreshInterval>300</refreshInterval>
        <viewRefreshMode>onRequest</viewRefreshMode>
        <viewRefreshTime>1</viewRefreshTime>
      </Link>
    </NetworkLink>
    
    <Style id="culoca-network-style">
      <IconStyle>
        <Icon>
          <href>https://culoca.com/culoca-icon.png</href>
        </Icon>
        <scale>1.0</scale>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>
    
    <Folder>
      <name>ℹ️ Informationen</name>
      <description>Über Culoca und diesen Network Link</description>
      <open>0</open>
      <Placemark>
        <name>Culoca Network Link</name>
        <description>
          <![CDATA[
          <h3>Live Culoca GPS-Items</h3>
          <p>Dieser Network Link lädt automatisch alle öffentlichen Culoca GPS-Items.</p>
          <p><strong>Auto-Update:</strong> Alle 5 Minuten</p>
          <p><strong>App-Seite:</strong> <a href="https://culoca.com">https://culoca.com</a></p>
          <p><strong>KML Download:</strong> <a href="https://culoca.com/web/google">https://culoca.com/web/google</a></p>
          <hr>
          <p><strong>Herausgeber:</strong></p>
          <p>DIRSCHL.com GmbH<br>
          Waldberg 84<br>
          84571 Reischach<br>
          <a href="https://dirschl.com">https://dirschl.com</a></p>
          <p><strong>Letzte Aktualisierung:</strong> ${new Date().toISOString()}</p>
          ]]>
        </description>
        <Point>
          <coordinates>12.5683,48.1351,0</coordinates>
        </Point>
        <styleUrl>#culoca-network-style</styleUrl>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

    return new Response(networkKml, {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml',
        'Content-Disposition': 'inline; filename="culoca-network.kml"',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error generating Network KML:', error);
    return new Response('Error generating Network KML', { status: 500 });
  }
};
