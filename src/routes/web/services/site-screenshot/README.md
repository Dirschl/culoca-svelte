# Site Screenshot Service

Ein Service zum Erstellen von Screenshots von Websites, der später von WordPress oder anderen Anwendungen aufgerufen werden kann.

## Endpoint

```
/web/services/site-screenshot
```

## Verwendung

### GET Request (Einfach)

```
GET /web/services/site-screenshot?url=https://example.com&width=1920&height=1080&format=jpeg
```

**Parameter:**
- `url` (erforderlich): Die URL der Website, die gescreenshotet werden soll
- `width` (optional): Viewport-Breite in Pixel (Standard: 1920)
- `height` (optional): Viewport-Höhe in Pixel (Standard: 1080)
- `fullPage` (optional): Vollständige Seite erfassen (Standard: false)
- `format` (optional): Bildformat 'png' oder 'jpeg' (Standard: 'jpeg')
- `quality` (optional): JPEG-Qualität 1-100 (Standard: 80)
- `waitUntil` (optional): Warte-Strategie 'load' | 'networkidle' | 'domcontentloaded' (Standard: 'networkidle')
- `timeout` (optional): Timeout in Millisekunden (Standard: 30000)

**Beispiel:**
```bash
curl "https://culoca.com/web/services/site-screenshot?url=https://example.com&width=1920&height=1080&format=jpeg" -o screenshot.jpg
```

### POST Request (Für WordPress)

```
POST /web/services/site-screenshot
Content-Type: application/json

{
  "url": "https://example.com",
  "width": 1920,
  "height": 1080,
  "format": "jpeg",
  "quality": 80,
  "fullPage": false,
  "waitUntil": "networkidle",
  "timeout": 30000
}
```

**Response (JSON):**
```json
{
  "success": true,
  "url": "https://example.com",
  "format": "jpeg",
  "dimensions": {
    "width": 1920,
    "height": 1080,
    "fullPage": false
  },
  "image": "data:image/jpeg;base64,...",
  "timestamp": "2025-01-17T12:00:00.000Z"
}
```

## WordPress Integration

### PHP Beispiel

```php
<?php
function get_site_screenshot($url, $width = 1920, $height = 1080) {
    $api_url = 'https://culoca.com/web/services/site-screenshot';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Content-Type' => 'application/json',
        ],
        'body' => json_encode([
            'url' => $url,
            'width' => $width,
            'height' => $height,
            'format' => 'jpeg',
            'quality' => 80
        ]),
        'timeout' => 60
    ]);
    
    if (is_wp_error($response)) {
        return false;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if ($data && isset($data['success']) && $data['success']) {
        return $data['image']; // Base64 encoded image
    }
    
    return false;
}

// Verwendung
$screenshot = get_site_screenshot('https://example.com');
if ($screenshot) {
    echo '<img src="' . esc_attr($screenshot) . '" alt="Screenshot">';
}
?>
```

### WordPress Shortcode

```php
<?php
add_shortcode('site_screenshot', function($atts) {
    $atts = shortcode_atts([
        'url' => '',
        'width' => 1920,
        'height' => 1080
    ], $atts);
    
    if (empty($atts['url'])) {
        return 'Bitte eine URL angeben: [site_screenshot url="https://example.com"]';
    }
    
    $screenshot = get_site_screenshot($atts['url'], $atts['width'], $atts['height']);
    
    if ($screenshot) {
        return '<img src="' . esc_attr($screenshot) . '" alt="Screenshot" style="max-width: 100%; height: auto;">';
    }
    
    return 'Fehler beim Erstellen des Screenshots.';
});
?>
```

**Verwendung im Editor:**
```
[site_screenshot url="https://example.com" width="1920" height="1080"]
```

## Limits

- **Maximale Auflösung:** 4096x4096 Pixel
- **Minimale Auflösung:** 100x100 Pixel
- **Timeout:** Standard 30 Sekunden (maximal 60 Sekunden empfohlen)
- **Format:** PNG oder JPEG
- **JPEG Qualität:** 1-100

## Fehlerbehandlung

Bei Fehlern wird ein JSON-Objekt zurückgegeben:

```json
{
  "error": "Fehlermeldung",
  "message": "Detaillierte Fehlermeldung"
}
```

**Häufige Fehler:**
- `400`: Fehlende oder ungültige URL
- `500`: Server-Fehler oder Timeout

## Caching

Screenshots werden mit einem Cache-Control Header von 1 Stunde versehen. Bei wiederholten Anfragen für die gleiche URL wird der gecachte Screenshot zurückgegeben.

## Technische Details

- **Browser:** Chromium (via Playwright)
- **User-Agent:** Standard Chrome User-Agent
- **Warte-Strategie:** Standardmäßig wird auf 'networkidle' gewartet, um sicherzustellen, dass alle Ressourcen geladen sind

