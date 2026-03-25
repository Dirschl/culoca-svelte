<script lang="ts">
  import { pickBestExifCaptureDateFormatted } from '$lib/metadata/exifDate';
  import { fixTextEncodingIfNeeded } from '$lib/utils/utf8Mojibake';

  export let image: any;

  let showFullExif = false;

  function exifStr(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'string') {
      const t = v.trim();
      return t ? fixTextEncodingIfNeeded(t) ?? t : '';
    }
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  }

  $: captureDateLabel = pickBestExifCaptureDateFormatted(image?.exif_data);
  $: artistLabel = exifStr(image?.exif_data?.Artist);
  $: copyrightLabel = exifStr(image?.exif_data?.Copyright);
  $: softwareLabel = exifStr(image?.exif_data?.Software);
  $: timeCreatedLabel = exifStr(image?.exif_data?.TimeCreated);
</script>

<!-- Nur noch EXIF/Meta-Daten anzeigen, ohne äußeres Grid -->
<div class="meta-column">
  <button type="button" class="exif-toggle" on:click={() => (showFullExif = !showFullExif)}>Aufnahmedaten</button>
  {#if !showFullExif}
    {#if image.width && image.height}
      <div class="meta-line">Auflösung: {image.width}×{image.height} px</div>
    {/if}
    {#if image.exif_data && image.exif_data.FileSize}
      <div class="meta-line">Dateigröße: {image.exif_data.FileSize} Bytes</div>
    {/if}
    {#if image.exif_data && image.exif_data.Make}
      <div class="meta-line">
        Kamera: {exifStr(image.exif_data.Make)}
        {exifStr(image.exif_data.Model) ? ` ${exifStr(image.exif_data.Model)}` : ''}
      </div>
    {/if}
    {#if image.exif_data && exifStr(image.exif_data.LensModel)}
      <div class="meta-line">Objektiv: {exifStr(image.exif_data.LensModel)}</div>
    {/if}
    {#if image.exif_data && image.exif_data.FocalLength}
      <div class="meta-line">
        Brennweite: {image.exif_data.FocalLength} mm{#if image.exif_data.FocalLengthIn35mmFormat && image.exif_data.FocalLengthIn35mmFormat !== image.exif_data.FocalLength}
          (35mm: {image.exif_data.FocalLengthIn35mmFormat} mm){/if}
      </div>
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
    {#if captureDateLabel}
      <div class="meta-line">Aufgenommen: {captureDateLabel}</div>
    {/if}
    {#if image.lat && image.lon}
      <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
    {/if}
    {#if artistLabel}
      <div class="meta-line">Fotograf: {artistLabel}</div>
    {/if}
    {#if copyrightLabel}
      <div class="meta-line">Copyright: {copyrightLabel}</div>
    {/if}
    {#if image.created_at}
      <div class="meta-line">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
    {/if}
  {:else}
    {#if image.width && image.height}
      <div class="meta-line">Auflösung: {image.width}×{image.height} px</div>
    {/if}
    {#if image.exif_data && image.exif_data.FileSize}
      <div class="meta-line">Dateigröße: {image.exif_data.FileSize} Bytes</div>
    {/if}
    {#if image.exif_data && image.exif_data.Make}
      <div class="meta-line">
        Kamera: {exifStr(image.exif_data.Make)}
        {exifStr(image.exif_data.Model) ? ` ${exifStr(image.exif_data.Model)}` : ''}
      </div>
    {/if}
    {#if image.exif_data && exifStr(image.exif_data.LensModel)}
      <div class="meta-line">Objektiv: {exifStr(image.exif_data.LensModel)}</div>
    {/if}
    {#if image.exif_data && image.exif_data.FocalLength}
      <div class="meta-line">
        Brennweite: {image.exif_data.FocalLength} mm{#if image.exif_data.FocalLengthIn35mmFormat && image.exif_data.FocalLengthIn35mmFormat !== image.exif_data.FocalLength}
          (35mm: {image.exif_data.FocalLengthIn35mmFormat} mm){/if}
      </div>
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
    {#if captureDateLabel}
      <div class="meta-line">Aufgenommen: {captureDateLabel}</div>
    {/if}
    {#if image.lat && image.lon}
      <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
    {/if}
    {#if artistLabel}
      <div class="meta-line">Fotograf: {artistLabel}</div>
    {/if}
    {#if copyrightLabel}
      <div class="meta-line">Copyright: {copyrightLabel}</div>
    {/if}
    {#if image.created_at}
      <div class="meta-line">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
    {/if}
    {#if image.exif_data}
      {#if image.exif_data.Flash != null && image.exif_data.Flash !== '' && typeof image.exif_data.Flash !== 'object'}
        <div class="meta-line">Blitz: {image.exif_data.Flash}</div>
      {/if}
      {#if softwareLabel}
        <div class="meta-line">Software: {softwareLabel}</div>
      {/if}
      {#if timeCreatedLabel}
        <div class="meta-line">Aufnahmezeit: {timeCreatedLabel}</div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .exif-toggle {
    cursor: pointer;
    transition: color 0.2s ease;
    border: none;
    background: transparent;
    font: inherit;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem;
    padding: 0;
    text-align: left;
  }
  .exif-toggle:hover {
    color: var(--culoca-orange);
  }
  .meta-line {
    color: var(--text-secondary);
    font-size: 0.85em;
    padding: 0.05em 0;
    word-break: break-word;
    background: transparent;
  }
</style>
