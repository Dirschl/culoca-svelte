# Radius URL Feature

## Übersicht

Die Radius URL Feature ermöglicht es Benutzern, spezifische Radius-Einstellungen über URL-Parameter zu teilen. Wenn ein Benutzer den Radius-Slider anpasst, wird der Wert automatisch in die URL eingefügt und kann mit anderen geteilt werden.

## Funktionalität

### URL-Parameter
- **Parameter:** `r=2000`
- **Beispiel:** `https://culoca.com/item/example?r=2000`
- **Bereich:** 50-3000 Meter (entsprechend dem Slider)

### Automatisches Verhalten

1. **Beim Laden der Seite:**
   - Wenn `r=2000` in der URL steht, wird der Radius-Slider auf 2000m gesetzt
   - Der Wert wird in localStorage gespeichert für zukünftige Verwendung

2. **Beim Ändern des Radius:**
   - Der neue Radius-Wert wird in localStorage gespeichert
   - Die URL wird automatisch mit dem `r`-Parameter aktualisiert
   - Beispiel: `https://culoca.com/item/example?r=1500`

3. **Beim Teilen des Links:**
   - Der Empfänger sieht den Radius-Slider auf dem geteilten Wert
   - Die Nearby-Galerie zeigt Items im angegebenen Radius

## Implementierung

### FilterStore Erweiterungen

```typescript
// Neue Funktionen im filterStore
filterStore.updateRadius(radius: number)  // Radius setzen und URL aktualisieren
filterStore.getRadius()                   // Aktuellen Radius-Wert abrufen
```

### URL-Parameter Verarbeitung

```typescript
// In initFromUrl()
const radiusParam = searchParams.get('r');
if (radiusParam) {
  const radiusValue = parseInt(radiusParam);
  if (!isNaN(radiusValue) && radiusValue > 0) {
    localStorage.setItem('radius', radiusValue.toString());
  }
}
```

### Radius-Slider Integration

```typescript
// In Item-Detail-Seite
function onRadiusChange(e) {
  radius = +e.target.value;
  if (typeof window !== 'undefined') {
    localStorage.setItem('radius', String(radius));
    filterStore.updateRadius(radius); // URL aktualisieren
  }
}
```

## Beispiele

### Verschiedene Radius-Werte teilen

- **Kleine Umgebung:** `https://culoca.com/item/example?r=500`
- **Mittlere Umgebung:** `https://culoca.com/item/example?r=1500`
- **Große Umgebung:** `https://culoca.com/item/example?r=3000`

### Kombination mit anderen Filtern

- **Radius + User-Filter:** `https://culoca.com/item/example?r=2000&user=user123`
- **Radius + Location-Filter:** `https://culoca.com/item/example?r=1500&lat=48.3&lon=12.7&location=München`

## Technische Details

### Validierung
- Nur positive Zahlen werden akzeptiert
- Bereich: 50-3000 Meter (entsprechend Slider-Min/Max)
- Fallback: 1000m wenn ungültiger Wert

### Persistierung
- Radius-Wert wird in localStorage gespeichert
- URL wird bei jeder Änderung aktualisiert
- Beim Laden wird localStorage bevorzugt, dann URL-Parameter

### Kompatibilität
- Rückwärtskompatibel: Links ohne `r`-Parameter funktionieren weiterhin
- Standard-Radius: 1000m wenn kein Parameter vorhanden 