import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
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
      <name>📸 Culoca Items</name>
      <description>GPS-gebundene Fotos und Bilder</description>
      <open>1</open>
      
      <Placemark>
        <name>Brandmühle Wegkreuz</name>
        <description>Historisches Wegkreuz bei der Brandmühle</description>
        <Point>
          <coordinates>12.5683,48.1351,0</coordinates>
        </Point>
        <styleUrl>#culoca-style</styleUrl>
      </Placemark>
      
      <Placemark>
        <name>Reischach Kirche</name>
        <description>Pfarrkirche St. Michael in Reischach</description>
        <Point>
          <coordinates>12.5702,48.1365,0</coordinates>
        </Point>
        <styleUrl>#culoca-style</styleUrl>
      </Placemark>
      
      <Placemark>
        <name>Waldberg Aussicht</name>
        <description>Schöne Aussicht vom Waldberg</description>
        <Point>
          <coordinates>12.5750,48.1400,0</coordinates>
        </Point>
        <styleUrl>#culoca-style</styleUrl>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  return new Response(kmlContent, {
    headers: {
      'Content-Type': 'application/vnd.google-earth.kml+xml',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
};