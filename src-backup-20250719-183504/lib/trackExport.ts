import type { Track } from './trackStore';

export function exportAsGPX(track: Track): string {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Culoca GPS Tracker">
  <metadata>
    <name>${track.name}</name>
    <time>${track.startTime}</time>
    ${track.endTime ? `<desc>Duration: ${formatDuration(track.totalDuration)}, Distance: ${formatDistance(track.totalDistance)}</desc>` : ''}
  </metadata>
  <trk>
    <name>${track.name}</name>
    <trkseg>`;
    
  track.points.forEach(point => {
    gpx += `
      <trkpt lat="${point.lat}" lon="${point.lon}">
        <time>${point.timestamp}</time>
        ${point.elevation ? `<ele>${point.elevation}</ele>` : ''}
        ${point.accuracy ? `<hdop>${point.accuracy}</hdop>` : ''}
      </trkpt>`;
  });
  
  gpx += `
    </trkseg>
  </trk>
</gpx>`;
  
  return gpx;
}

export function exportAsGeoJSON(track: Track): string {
  const geojson = {
    type: "Feature",
    properties: {
      name: track.name,
      startTime: track.startTime,
      endTime: track.endTime,
      totalDistance: track.totalDistance,
      totalDuration: track.totalDuration,
      isActive: track.isActive
    },
    geometry: {
      type: "LineString",
      coordinates: track.points.map(p => [p.lon, p.lat])
    }
  };
  
  return JSON.stringify(geojson, null, 2);
}

export function exportAsKML(track: Track): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${track.name}</name>
    <description>Track recorded with Culoca GPS Tracker</description>
    <Placemark>
      <name>${track.name}</name>
      <description>
        Start: ${new Date(track.startTime).toLocaleString()}
        ${track.endTime ? `End: ${new Date(track.endTime).toLocaleString()}` : ''}
        Distance: ${formatDistance(track.totalDistance)}
        Duration: ${formatDuration(track.totalDuration)}
      </description>
      <LineString>
        <coordinates>`;
        
  track.points.forEach(point => {
    kml += `
          ${point.lon},${point.lat}${point.elevation ? `,${point.elevation}` : ''}`;
  });
  
  kml += `
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
  
  return kml;
}

export function downloadTrack(track: Track, format: 'gpx' | 'geojson' | 'kml') {
  let content: string;
  let filename: string;
  let mimeType: string;
  
  switch (format) {
    case 'gpx':
      content = exportAsGPX(track);
      filename = `${track.name.replace(/[^a-z0-9]/gi, '_')}.gpx`;
      mimeType = 'application/gpx+xml';
      break;
    case 'geojson':
      content = exportAsGeoJSON(track);
      filename = `${track.name.replace(/[^a-z0-9]/gi, '_')}.geojson`;
      mimeType = 'application/geo+json';
      break;
    case 'kml':
      content = exportAsKML(track);
      filename = `${track.name.replace(/[^a-z0-9]/gi, '_')}.kml`;
      mimeType = 'application/vnd.google-earth.kml+xml';
      break;
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function emailTrack(track: Track, email: string): Promise<boolean> {
  try {
    const gpxContent = exportAsGPX(track);
    const geojsonContent = exportAsGeoJSON(track);
    
    const response = await fetch('/api/tracks/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        track,
        email,
        gpxContent,
        geojsonContent
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error sending track email:', error);
    return false;
  }
}

// Helper functions
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(2)}km`;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
} 