<script lang="ts">
  export let image: any;
  $: keywords = image?.keywords ?? [];
  export let isCreator: boolean;
  export let editingKeywords: boolean;
  export let keywordsEditValue: string;
  export let keywordsCount: number;
  export let keywordsValid: boolean;
  export let keywordsTooMany: boolean;
  export let startEditKeywords: () => void;
  export let saveKeywords: () => void;
  export let cancelEditKeywords: () => void;
  export let handleKeywordsKeydown: (e: KeyboardEvent) => void;
</script>

<h2 class="keywords-title" class:editable={isCreator} class:editing={editingKeywords} on:click={startEditKeywords}>
  Keywords
</h2>
{#if editingKeywords}
  <div class="keywords-edit-container">
    <textarea
      id="keywords-edit-input"
      bind:value={keywordsEditValue}
      maxlength="500"
      on:keydown={handleKeywordsKeydown}
      on:blur={saveKeywords}
      class="keywords-edit-input"
      class:valid={keywordsValid}
      class:too-many={keywordsTooMany}
      placeholder="Keywords durch Kommas getrennt eingeben..."
      rows="8"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="sentences"
    ></textarea>
    <span class="char-count" class:valid={keywordsValid} class:too-many={keywordsTooMany}>
      {keywordsCount}/50
    </span>
  </div>
{:else}
  {#if keywords && keywords.length > 0}
    <div class="keywords">
      {#each keywords as kw}
        <a href="/?s={encodeURIComponent(kw)}" class="chip keyword-link">{kw}</a>
      {/each}
    </div>
  {:else}
    <div class="keywords-placeholder">
      {isCreator ? 'Klicke auf "Keywords" um welche hinzuzufügen' : 'Keine Keywords verfügbar'}
    </div>
  {/if}
{/if}

<style>
.keywords-column h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  padding: 0;
}
  .keywords-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    cursor: pointer;
  }
  .keywords-title.editable {
    cursor: pointer;
    transition: color .2s;
    background: transparent;
  }
  .keywords-title.editing {
    color: #fff;
    background: var(--accent-color);
    border-radius: 6px;
    padding: 0.2rem 0.7rem;
  }
  .keywords-edit-container {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: 0.5rem;
    background: #fff;
    border-radius: 6px;
  }
  :global(body[data-theme='dark']) .keywords-edit-container {
    background: #222;
  }
  .keywords-edit-input {
    font-size: 1rem;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    border: 1px solid #ccc;
    min-height: 80px;
    resize: vertical;
    color: #222;
    background: #fff;
  }
  :global(body[data-theme='dark']) .keywords-edit-input {
    color: #fff;
    background: #222;
    border: 1px solid #444;
  }
  .char-count {
    font-size: 0.95rem;
    color: #888;
    align-self: flex-end;
  }
  .char-count.valid {
    color: var(--accent-color);
  }
  .char-count.too-many {
    color: #dc2626;
    font-weight: 600;
  }
  .keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0 0 1rem 0;
  }
  .chip.keyword-link {
    background: var(--bg-tertiary);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.95rem;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    text-decoration: none;
    transition: background 0.2s;
  }
  .chip.keyword-link:hover {
    background: var(--accent-color);
    color: #fff;
  }
  .keywords-placeholder {
    color: #888;
    font-style: italic;
    margin-bottom: 1rem;
  }
  .keywords-title.editable.svelte {
    cursor: pointer;
    transition: color .2s;
    background: transparent;
  }
  .chip.keyword-link {
    background: var(--bg-tertiary);
    padding: .25rem .75rem;
    border-radius: 999px;
    font-size: .8rem;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }
</style> 