<script lang="ts">
  export let image: any;
  export let isCreator: boolean;
  // Local state for EXIF toggle
  let showFullExif = false;
</script>

<!-- Nur noch EXIF/Meta-Daten anzeigen, ohne äußeres Grid -->
<div class="meta-column">
  <h2 class="exif-toggle" on:click={() => showFullExif = !showFullExif}>Aufnahmedaten</h2>
  {#if !showFullExif}
    <!-- Essential EXIF data -->
    {#if image.width && image.height}
      <div class="meta-line">Auflösung: {image.width}×{image.height} px</div>
    {/if}
    {#if image.exif_data && image.exif_data.FileSize}
      <div class="meta-line">Dateigröße: {image.exif_data.FileSize} Bytes</div>
    {/if}
    {#if image.exif_data && image.exif_data.Make}
      <div class="meta-line">Kamera: {image.exif_data.Make} {image.exif_data.Model || ''}</div>
    {/if}
    {#if image.exif_data && image.exif_data.LensModel}
      <div class="meta-line">Objektiv: {image.exif_data.LensModel}</div>
    {/if}
    {#if image.exif_data && image.exif_data.FocalLength}
      <div class="meta-line">Brennweite: {image.exif_data.FocalLength} mm{#if image.exif_data.FocalLengthIn35mmFormat && image.exif_data.FocalLengthIn35mmFormat !== image.exif_data.FocalLength} (35mm: {image.exif_data.FocalLengthIn35mmFormat} mm){/if}</div>
    {/if}
    {#if image.exif_data && image.exif_data.ISO}
      <div class="meta-line">ISO: {image.exif_data.ISO}</div>
    {/if}
    {#if image.exif_data && image.exif_data.FNumber}
      <div class="meta-line">Blende: ƒ/{image.exif_data.FNumber}</div>
    {/if}
    {#if image.exif_data && image.exif_data.ExposureTime}
      <div class="meta-line">Verschlusszeit: {image.exif_data.ExposureTime} s</div>
    {/if}
    {#if image.exif_data && image.exif_data.CreateDate}
      <div class="meta-line">Aufgenommen: {new Date(image.exif_data.CreateDate).toLocaleDateString('de-DE')}</div>
    {/if}
    {#if image.lat && image.lon}
      <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
    {/if}
    {#if image.exif_data && image.exif_data.Artist}
      <div class="meta-line">Fotograf: {image.exif_data.Artist}</div>
    {/if}
    {#if image.exif_data && image.exif_data.Copyright}
      <div class="meta-line">Copyright: {image.exif_data.Copyright}</div>
    {/if}
    {#if image.created_at}
      <div class="meta-line">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
    {/if}
  {:else}
    <!-- Full EXIF data -->
    {#if image.width && image.height}
      <div class="meta-line">Auflösung: {image.width}×{image.height} px</div>
    {/if}
    {#if image.exif_data && image.exif_data.FileSize}
      <div class="meta-line">Dateigröße: {image.exif_data.FileSize} Bytes</div>
    {/if}
    {#if image.exif_data && image.exif_data.Make}
      <div class="meta-line">Kamera: {image.exif_data.Make} {image.exif_data.Model || ''}</div>
    {/if}
    {#if image.exif_data && image.exif_data.LensModel}
      <div class="meta-line">Objektiv: {image.exif_data.LensModel}</div>
    {/if}
    {#if image.exif_data && image.exif_data.FocalLength}
      <div class="meta-line">Brennweite: {image.exif_data.FocalLength} mm{#if image.exif_data.FocalLengthIn35mmFormat && image.exif_data.FocalLengthIn35mmFormat !== image.exif_data.FocalLength} (35mm: {image.exif_data.FocalLengthIn35mmFormat} mm){/if}</div>
    {/if}
    {#if image.exif_data && image.exif_data.ISO}
      <div class="meta-line">ISO: {image.exif_data.ISO}</div>
    {/if}
    {#if image.exif_data && image.exif_data.FNumber}
      <div class="meta-line">Blende: ƒ/{image.exif_data.FNumber}</div>
    {/if}
    {#if image.exif_data && image.exif_data.ExposureTime}
      <div class="meta-line">Verschlusszeit: {image.exif_data.ExposureTime} s</div>
    {/if}
    {#if image.exif_data && image.exif_data.Orientation}
      <div class="meta-line">Ausrichtung: {image.exif_data.Orientation}</div>
    {/if}
    {#if image.exif_data && image.exif_data.CreateDate}
      <div class="meta-line">Aufgenommen: {new Date(image.exif_data.CreateDate).toLocaleDateString('de-DE')}</div>
    {/if}
    {#if image.lat && image.lon}
      <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
    {/if}
    {#if image.exif_data && image.exif_data.Artist}
      <div class="meta-line">Fotograf: {image.exif_data.Artist}</div>
    {/if}
    {#if image.exif_data && image.exif_data.Copyright}
      <div class="meta-line">Copyright: {image.exif_data.Copyright}</div>
    {/if}
    {#if image.created_at}
      <div class="meta-line">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
    {/if}
    <!-- Additional selected EXIF fields -->
    {#if image.exif_data}
      {#if image.exif_data.Flash}
        <div class="meta-line">Blitz: {image.exif_data.Flash}</div>
      {/if}
      {#if image.exif_data.Software}
        <div class="meta-line">Software: {image.exif_data.Software}</div>
      {/if}
      {#if image.exif_data.TimeCreated}
        <div class="meta-line">Aufnahmezeit: {image.exif_data.TimeCreated}</div>
      {/if}
    {/if}
  {/if}
</div>

<style>
.meta-column h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  padding: 0;
}
.meta-section.single-exif {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 2rem;
  margin: 2rem 0 1.5rem 0;
  background: transparent;
  border-radius: 0;
  padding: 1rem;
  align-items: flex-start;
  overflow: hidden;
}
.meta-column, .column-card, .keywords-column {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: transparent;
}
.exif-toggle {
  cursor: pointer;
  transition: color 0.2s ease;
}
.exif-toggle:hover {
  color: var(--culoca-orange);
}
.filename {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
  word-break: break-all;
}
.meta-line {
  color: var(--text-secondary);
  font-size: 0.85em;
  padding: 0.05em 0;
  word-break: break-word;
  background: transparent;
}
.column-card {
  background: transparent;
  box-shadow: none;
  padding: 0;
  border-radius: 0;
}
@media (max-width: 900px) {
  .meta-section.single-exif {
    grid-template-columns: 1fr;
    padding: 1rem 0.5rem;
    gap: 1.5rem;
  }
  .keywords-column, .meta-column, .column-card {
    text-align: center;
  }
}
@media (max-width: 1200px) {
  .meta-section.single-exif {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .keywords-column, .meta-column, .column-card {
    text-align: center;
  }
}
</style> 