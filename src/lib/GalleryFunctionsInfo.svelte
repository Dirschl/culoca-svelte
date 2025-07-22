<script lang="ts">
  // Keine Props nötig, reiner Info-Block
</script>

<div class="gallery-functions-info">
  <div class="explanation-content">
    <h3>Galerie-Funktionen</h3>
    <p>Zeigt dir nur Bilder in einem 10 × 10‑Kilometer‑Quadrat – mindestens 5 km rund um deinen aktuellen Standort, selbst wenn du dich bewegst. Bilder außerhalb deiner Planquadrate werden verworfen und neue werden bei erreichen eines neuen Quadranten hinzugefügt.</p>
    <h4>Normale Galerie</h4>
    <p>Wechsle in den Endlos‑Modus und scrolle, bis der Daumen glüht: Die App lädt fortlaufend 100er‑Pakete an Bildern sortiert nach Entfernung zu deinem Standort, bis wirklich alles gezeigt wurde. Default beim starten der App, Wechsel durch klick auf die GPS Koordinaten.</p>
    <h4>Location Filter</h4>
    <p>Tippe auf ein Bild, um einen entfernten Spot zu wählen. Mit dem Culoca‑Marker setzt du ihn als neues Zentrum deiner Suche – perfekt, um schon mal eine fremde Region zu erkunden.</p>
  </div>
</div>

<style>
  .gallery-functions-info {
    margin: 2rem 0;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 16px;
    box-shadow: 0 2px 8px var(--shadow);
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }
  .explanation-content h3 {
    margin-top: 0;
    font-size: 1.3rem;
    color: var(--accent-color);
  }
  .explanation-content h4 {
    margin-bottom: 0.3rem;
    margin-top: 1.2rem;
    font-size: 1.1rem;
    color: var(--text-primary);
  }
  .explanation-content p {
    margin: 0 0 0.7rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }
</style> 