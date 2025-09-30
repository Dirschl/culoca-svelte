import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Culoca GPS Items</name>
    <description>Test KML</description>
    <Placemark>
      <name>Test</name>
      <Point>
        <coordinates>12.5683,48.1351,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

  return new Response(kmlContent, {
    headers: {
      'Content-Type': 'application/vnd.google-earth.kml+xml'
    }
  });
};