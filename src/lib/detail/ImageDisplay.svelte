<script lang="ts">
  export let image: any;
  export let isCreator: boolean;
  export let editingTitle: boolean;
  export let titleEditValue: string;
  export let editingDescription: boolean;
  export let descriptionEditValue: string;
  export let startEditTitle: () => void;
  export let saveTitle: () => void;
  export let cancelEditTitle: () => void;
  export let handleTitleKeydown: (event: KeyboardEvent) => void;
  export let startEditDescription: () => void;
  export let saveDescription: () => void;
  export let cancelEditDescription: () => void;
  export let handleDescriptionKeydown: (event: KeyboardEvent) => void;
  export let imageSource: string;
  export let darkMode: boolean;
</script>

<div class="passepartout-container" class:dark={darkMode}>
  <a href="/" class="image-link">
    <img
      src={imageSource}
      alt={image.title || image.original_name || `Image ${image.id}`}
      class="main-image"
      width={image.width}
      height={image.height}
      data-filename={image.original_name}
    />
  </a>
  <div class="passepartout-info">
    <h1 class="title" class:editable={isCreator} class:editing={editingTitle}>
      {#if editingTitle}
        <div class="title-edit-container">
          <input
            id="title-edit-input"
            type="text"
            bind:value={titleEditValue}
            maxlength="60"
            on:keydown={handleTitleKeydown}
            on:blur={saveTitle}
            class="title-edit-input"
            class:valid={titleEditValue.length >= 40}
            placeholder="Titel eingeben..."
            autocomplete="off"
            autocorrect="off"
            autocapitalize="sentences"
            inputmode="text"
          />
          <span class="char-count" class:valid={titleEditValue.length >= 40}>
            {titleEditValue.length}/60
          </span>
        </div>
      {:else}
        <span class="title-text" on:click={startEditTitle}>
          {image.title || image.original_name || `Bild ${image.id?.substring(0, 8)}...`}
        </span>
      {/if}
    </h1>
    <p class="description" class:editable={isCreator} class:editing={editingDescription}>
      {#if editingDescription}
        <div class="description-edit-container">
          <textarea
            id="description-edit-input"
            bind:value={descriptionEditValue}
            maxlength="160"
            on:keydown={handleDescriptionKeydown}
            on:blur={saveDescription}
            class="description-edit-input"
            class:valid={descriptionEditValue.length >= 140}
            placeholder="Beschreibung eingeben..."
            rows="3"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="sentences"
            inputmode="text"
          ></textarea>
          <span class="char-count" class:valid={descriptionEditValue.length >= 140}>
            {descriptionEditValue.length}/160
          </span>
        </div>
      {:else}
        <span class="description-text" on:click={startEditDescription}>
          {#if image.description}
            {image.description}
          {:else}
            <span class="placeholder">Keine Beschreibung verfügbar</span>
          {/if}
        </span>
      {/if}
    </p>
  </div>
</div>

<style>
.passepartout-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  padding: 12px 12px 12px 12px;
  background: #f5f5f5;
  margin: 0 auto;
  border-radius: 0;
  overflow: hidden;
}
.passepartout-container.dark {
  background: #1a1a1a;
  overflow: hidden;
}
.image-link {
  display: block;
  width: 100%;
  text-decoration: none;
  color: inherit;
}
.main-image {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 800px;
  object-fit: contain;
  border: 1px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  background: transparent;
  margin: 0 auto;
  border-radius: 0;
}
.passepartout-info {
  margin-top: 1.5rem;
  text-align: center;
  width: 100%;
  padding: 0.7rem 0.5rem 0.5rem 0.5rem;
  background: transparent;
}
.title {
  font-size: 1.8rem;
  font-weight: 600;
  color: white;
  margin: 0 0 1rem 0;
  line-height: 1.3;
  background: transparent;
}
.passepartout-container:not(.dark) .title {
  color: #4a4a4a;
  font-weight: 700;
  background: transparent;
}
.description {
  font-size: 1rem;
  color: #ccc;
  line-height: 1.6;
  margin: 0 0 0.5rem 0;
  background: transparent;
}
.passepartout-container:not(.dark) .description {
  color: #6b6b6b;
  font-weight: 500;
  background: transparent;
}
.description.placeholder {
  color: #666;
  font-style: italic;
  background: transparent;
}
.passepartout-container:not(.dark) .description.placeholder {
  color: #999;
  font-style: italic;
  background: transparent;
}
.title-edit-container, .description-edit-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
}
.passepartout-container:not(.dark) .title-edit-container,
.passepartout-container:not(.dark) .description-edit-container {
  background: #fff;
  border-radius: 4px;
}
.passepartout-container.dark .title-edit-container,
.passepartout-container.dark .description-edit-container {
  background: #222;
  border-radius: 4px;
}
.title-edit-input, .description-edit-input {
  font-size: 1.1rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  width: 100%;
  color: #222;
  background: #fff;
  border: 1px solid #ccc;
}
.passepartout-container.dark .title-edit-input,
.passepartout-container.dark .description-edit-input {
  color: #fff;
  background: #222;
  border: 1px solid #444;
}
.char-count {
  font-size: 0.9rem;
  color: #888;
  margin-left: 0.5rem;
}
.char-count.valid {
  color: #22a722;
}
</style> 