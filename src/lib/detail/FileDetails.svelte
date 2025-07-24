<script lang="ts">
  export let image: any;
  export let isCreator: boolean;
  export let editingFilename: boolean;
  export let filenameEditValue: string;
  export let startEditFilename: () => void;
  export let saveFilename: () => void;
  export let handleFilenameKeydown: (e: KeyboardEvent) => void;
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
<div class="filename">
  64px: {fileSizes.size64 ? formatFileSize(fileSizes.size64) : 'unbekannt'}  |  512px: {fileSizes.size512 ? formatFileSize(fileSizes.size512) : 'unbekannt'}  |  2048px: {fileSizes.size2048 ? formatFileSize(fileSizes.size2048) : 'unbekannt'}
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
  .filename.editing {
    background: #f3f4f6;
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
  }
  .filename-edit-container {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .filename-edit-input {
    font-size: 1rem;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    width: 220px;
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