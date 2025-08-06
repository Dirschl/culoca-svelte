<script lang="ts">
  export let image: any;
  export let isCreator: boolean;
  export let editingFilename: boolean;
  export let filenameEditValue: string;
  export let startEditFilename: () => void;
  export let saveFilename: () => void;
  export let cancelEditFilename: () => void;
  export let handleFilenameKeydown: (e: KeyboardEvent) => void;
  export let editingSlug: boolean;
  export let slugEditValue: string;
  export let startEditSlug: () => void;
  export let saveSlug: () => void;
  export let cancelEditSlug: () => void;
  export let handleSlugKeydown: (e: KeyboardEvent) => void;
  export let fileSizes: { size64: number|null, size512: number|null, size2048: number|null };
  export let formatFileSize: (bytes: number) => string;
  export let browser: boolean;
</script>

<h2>File Details</h2>
<div class="filename" class:editable={isCreator} class:editing={editingFilename}>
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
    <span class="filename-text" on:click={startEditFilename}>
      {image.original_name || 'Unbekannt'}
    </span>
  {/if}
</div>
<div class="filename">
  {browser ? window.location.href : ''}
</div>
{#if image.slug}
  <div class="filename" class:editable={isCreator} class:editing={editingSlug}>
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
      <span class="filename-text" on:click={startEditSlug}>
        Slug: {image.slug}
      </span>
    {/if}
  </div>
{/if}
<div class="filename">
  64px: {fileSizes && fileSizes.size64 ? formatFileSize(fileSizes.size64) : 'unbekannt'}  |
  512px: {fileSizes && fileSizes.size512 ? formatFileSize(fileSizes.size512) : 'unbekannt'}  |
  2048px: {fileSizes && fileSizes.size2048 ? formatFileSize(fileSizes.size2048) : 'unbekannt'}
</div>

<style>
h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  padding: 0;
}
  .filename {
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 0.3rem;
    word-break: break-all;
  }
  .filename.editable {
    cursor: pointer;
    color: var(--accent-color);
  }
  .filename.editing, .filename-edit-container {
    background: #fff;
    border-radius: 6px;
  }
  :global(body[data-theme='dark']) .filename.editing,
  :global(body[data-theme='dark']) .filename-edit-container {
    background: #222;
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
    cursor: pointer;
    transition: color .2s;
    display: inline-block;
    padding: .25rem .5rem;
    border-radius: 4px;
    margin: -.25rem -.5rem;
  }
</style> 