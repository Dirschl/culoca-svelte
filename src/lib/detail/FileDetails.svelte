<script lang="ts">
  type ManagementForm = {
    type_id: number;
    group_slug: string;
    group_root_item_id: string | null;
    nearby_gallery_mode: string;
    sort_order: string;
    content: string;
    starts_at: string;
    ends_at: string;
    external_url: string;
    video_url: string;
    event_display_mode: 'single_day' | 'multi_day';
    event_all_day: boolean;
    event_location_name: string;
    event_booking_url: string;
    event_is_free: boolean;
    event_price_text: string;
    event_online_url: string;
  };

  export let image: any;
  export let isCreator: boolean;
  export let editMode = false;
  export let editingFilename: boolean;
  export let filenameEditValue: string;
  export let startEditFilename: () => void;
  export let saveFilename: () => void;
  export let handleFilenameKeydown: (e: KeyboardEvent) => void;
  export let editingSlug: boolean;
  export let slugEditValue: string;
  export let startEditSlug: () => void;
  export let saveSlug: () => void;
  export let handleSlugKeydown: (e: KeyboardEvent) => void;
  export let fileSizes: { size64: number | null; size512: number | null; size2048: number | null };
  export let formatFileSize: (bytes: number) => string;
  export let browser: boolean;
  export let managementForm: ManagementForm;
  export let managementSaveMessage = '';
</script>

<h2>File Details</h2>

<div class="filename" class:editable={isCreator && editMode} class:editing={editingFilename}>
  {#if editingFilename}
    <div class="filename-edit-container">
      <input
        id="filename-edit-input"
        type="text"
        bind:value={filenameEditValue}
        maxlength="120"
        on:keydown={handleFilenameKeydown}
        on:blur={saveFilename}
        class="filename-edit-input"
        placeholder="Dateiname eingeben..."
        autocomplete="off"
        autocorrect="off"
        autocapitalize="words"
        inputmode="text"
      />
      <span class="char-count">
        {filenameEditValue.length}/120
      </span>
    </div>
  {:else}
    <button type="button" class="filename-text" on:click={startEditFilename} disabled={!isCreator || !editMode}>
      {image.original_name || 'Unbekannt'}
    </button>
  {/if}
</div>

<div class="filename">{browser ? window.location.href : ''}</div>

{#if image.slug}
  <div class="filename" class:editable={isCreator && editMode} class:editing={editingSlug}>
    {#if editingSlug}
      <div class="filename-edit-container">
        <input
          id="slug-edit-input"
          type="text"
          bind:value={slugEditValue}
          maxlength="100"
          on:keydown={handleSlugKeydown}
          on:blur={saveSlug}
          class="filename-edit-input"
          placeholder="Slug eingeben..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          inputmode="text"
        />
        <span class="char-count">
          {slugEditValue.length}/100
        </span>
      </div>
    {:else}
      <button type="button" class="filename-text" on:click={startEditSlug} disabled={!isCreator || !editMode}>
        Slug: {image.slug}
      </button>
    {/if}
  </div>
{/if}

<div class="filename">ID: {image?.id}</div>
<div class="filename">
  64px: {fileSizes && fileSizes.size64 ? formatFileSize(fileSizes.size64) : 'unbekannt'} |
  512px: {fileSizes && fileSizes.size512 ? formatFileSize(fileSizes.size512) : 'unbekannt'} |
  2048px: {fileSizes && fileSizes.size2048 ? formatFileSize(fileSizes.size2048) : 'unbekannt'}
</div>

{#if isCreator && editMode}
<div class="management-card">
  <div class="management-header">
    <h3>Content Management</h3>
    {#if managementSaveMessage}
      <span class:success={managementSaveMessage === 'Gespeichert'} class:error={managementSaveMessage !== 'Gespeichert'} class="save-message">
        {managementSaveMessage}
      </span>
    {/if}
  </div>

  <div class="management-grid">
    <label class="field">
      <span class="field-label">Sort Order</span>
      <input type="number" bind:value={managementForm.sort_order} placeholder="optional" disabled={!isCreator} />
    </label>

    <label class="field">
      <span class="field-label">Von</span>
      <input type="datetime-local" bind:value={managementForm.starts_at} disabled={!isCreator} />
    </label>

    <label class="field">
      <span class="field-label">Bis</span>
      <input type="datetime-local" bind:value={managementForm.ends_at} disabled={!isCreator} />
    </label>

    {#if managementForm.type_id === 2}
      <label class="field">
        <span class="field-label">Terminart</span>
        <select bind:value={managementForm.event_display_mode} disabled={!isCreator}>
          <option value="single_day">Einzeltag</option>
          <option value="multi_day">Mehrere Tage</option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Ganztägig</span>
        <input type="checkbox" bind:checked={managementForm.event_all_day} disabled={!isCreator} />
      </label>

      <label class="field field-full">
        <span class="field-label">Ort</span>
        <input type="text" bind:value={managementForm.event_location_name} placeholder="z.B. Stadthalle Burghausen" disabled={!isCreator} />
      </label>

      <label class="field field-full">
        <span class="field-label">Buchungslink</span>
        <input type="url" bind:value={managementForm.event_booking_url} placeholder="https://..." disabled={!isCreator} />
      </label>

      <label class="field">
        <span class="field-label">Kostenfrei</span>
        <input type="checkbox" bind:checked={managementForm.event_is_free} disabled={!isCreator} />
      </label>

      <label class="field">
        <span class="field-label">Preistext</span>
        <input type="text" bind:value={managementForm.event_price_text} placeholder="z.B. 12 EUR" disabled={!isCreator} />
      </label>

      <label class="field field-full">
        <span class="field-label">Online-Link</span>
        <input type="url" bind:value={managementForm.event_online_url} placeholder="https://..." disabled={!isCreator} />
      </label>
    {/if}

  </div>
</div>
{/if}

<style>
  h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem;
    padding: 0;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .filename {
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 0.3rem;
    word-break: break-all;
  }

  .filename.editable {
    cursor: default;
  }

  .filename.editing,
  .filename-edit-container {
    background: #fff;
    border-radius: 6px;
  }

  :global(body[data-theme='dark']) .filename.editing,
  :global(body[data-theme='dark']) .filename-edit-container {
    background: #222;
  }

  .filename-edit-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
  }

  .filename-edit-input {
    font-size: 1rem;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #ccc;
    width: 220px;
    color: #222;
    background: #fff;
  }

  :global(body[data-theme='dark']) .filename-edit-input {
    color: #fff;
    background: #222;
    border: 1px solid #444;
  }

  .char-count {
    font-size: 0.95rem;
    color: #888;
  }

  .filename-text {
    cursor: default;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin: -0.25rem -0.5rem;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .filename-text:hover {
    color: inherit;
  }

  .meta-grid {
    margin-top: 0.75rem;
    display: grid;
    gap: 0.5rem;
  }

  .meta-row {
    display: grid;
    gap: 0.2rem;
  }

  .meta-label,
  .field-label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
  }

  .meta-value {
    color: var(--text-primary);
    word-break: break-word;
  }

  .management-card {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 12px;
    background: var(--bg-secondary, rgba(0, 0, 0, 0.03));
  }

  .management-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .management-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
  }

  .field {
    display: grid;
    gap: 0.4rem;
  }

  .field-wide {
    grid-column: span 2;
  }

  .field-full {
    grid-column: 1 / -1;
  }

  .field input,
  .field select,
  .field textarea {
    width: 100%;
    border-radius: 8px;
    border: 1px solid var(--border-color, #ccc);
    background: var(--bg-primary, #fff);
    color: var(--text-primary);
    padding: 0.65rem 0.75rem;
    font: inherit;
    box-sizing: border-box;
  }

  .field input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    padding: 0;
  }

  .field-hint {
    color: var(--text-secondary);
  }
  .save-message {
    font-size: 0.85rem;
  }

  .save-message.success {
    color: #0a8a4b;
  }

  .save-message.error {
    color: #c0392b;
  }

  @media (max-width: 720px) {
    .management-grid {
      grid-template-columns: 1fr;
    }

    .field-wide,
    .field-full {
      grid-column: auto;
    }

    .management-header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
