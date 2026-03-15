<script lang="ts">
  export let image: any;
  export let isCreator: boolean;
  export let canEditQuickFields = false;
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
  export let rerenderingVariants = false;
  export let rerenderVariants: (() => void) | null = null;
  export let replacingOriginal = false;
  export let replaceOriginalFile: ((file: File) => void | Promise<void>) | null = null;

  let replaceOriginalInput: HTMLInputElement | null = null;

  function openReplaceOriginalDialog() {
    if (!replaceOriginalFile || !browser || replacingOriginal) return;
    replaceOriginalInput?.click();
  }

  async function handleReplaceOriginalChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !replaceOriginalFile) return;

    try {
      await replaceOriginalFile(file);
    } finally {
      target.value = '';
    }
  }
</script>

<h2>File Details</h2>

<div class="filename" class:editable={canEditQuickFields} class:editing={editingFilename}>
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
    <button type="button" class="filename-text" on:click={startEditFilename} disabled={!canEditQuickFields}>
      {image.original_name || 'Unbekannt'}
    </button>
  {/if}
</div>

{#if image.slug}
  <div class="filename" class:editable={canEditQuickFields} class:editing={editingSlug}>
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
      <button type="button" class="filename-text" on:click={startEditSlug} disabled={!canEditQuickFields}>
        Slug: {image.slug}
      </button>
    {/if}
  </div>
{/if}

{#if isCreator && editMode}
  <div class="filename">ID: {image?.id}</div>
{/if}
<div class="filename">
  64px: {fileSizes && fileSizes.size64 ? formatFileSize(fileSizes.size64) : 'unbekannt'} |
  512px: {fileSizes && fileSizes.size512 ? formatFileSize(fileSizes.size512) : 'unbekannt'} |
  2048px: {fileSizes && fileSizes.size2048 ? formatFileSize(fileSizes.size2048) : 'unbekannt'}
  {#if canEditQuickFields && editMode && rerenderVariants}
    <span class="file-action-separator">|</span>
    <button type="button" class="file-action-link" on:click={rerenderVariants} disabled={rerenderingVariants}>
      {rerenderingVariants ? 'Rendere Varianten neu...' : 'Varianten neu rendern'}
    </button>
  {/if}
  {#if canEditQuickFields && editMode && replaceOriginalFile}
    <span class="file-action-separator">|</span>
    <button
      type="button"
      class="file-action-link"
      on:click={openReplaceOriginalDialog}
      disabled={replacingOriginal}
    >
      {replacingOriginal ? 'Ersetze Original...' : 'Original ersetzen'}
    </button>
    <input
      bind:this={replaceOriginalInput}
      class="visually-hidden"
      type="file"
      accept="image/*"
      on:change={handleReplaceOriginalChange}
    />
  {/if}
</div>

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
    width: 100%;
  }

  .filename-edit-input {
    font-size: 1rem;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #ccc;
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
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
    width: 100%;
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

  .file-action-separator {
    margin: 0 0.35rem;
    color: var(--text-muted);
  }

  .file-action-link {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--culoca-orange);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  .file-action-link:disabled {
    opacity: 0.7;
    cursor: progress;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 900px) {
    h2,
    .filename {
      text-align: center;
    }

    .filename-edit-container {
      justify-content: center;
      flex-wrap: wrap;
    }

    .filename-text {
      width: 100%;
      text-align: center;
    }
  }

</style>
