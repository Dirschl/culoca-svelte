<script lang="ts">
  import { onMount } from 'svelte';
  import justifiedLayout from 'justified-layout';

  export let items: { src: string; width: number; height: number; id: string }[] = [];
  export let containerWidth = 1024;
  export let targetRowHeight = 200;  // Increased for better visibility
  export let gap = 1;  // Minimal gap for mobile

  let boxes = [];
  let layout = { boxes: [], containerHeight: 0 };
  
  // Reactive layout calculation
  $: if (items.length > 0 && containerWidth > 0) {
    try {
      const inputItems = items.map((item) => ({ 
        width: item.width || 400, 
        height: item.height || 300 
      }));
      
      layout = justifiedLayout(inputItems, { 
        containerWidth, 
        targetRowHeight, 
        boxSpacing: gap,
        maxNumRows: 100,  // Allow many rows
        forceAspectRatio: false,  // Keep original aspect ratios
        showWidows: true,  // Show incomplete last row
        fullWidthBreakoutRowCadence: false  // No full-width rows
      });
      
      boxes = layout.boxes || [];
      
      console.log('Adobe Stock-style layout calculated:', {
        itemCount: items.length,
        containerWidth,
        targetRowHeight,
        boxes: boxes.length,
        containerHeight: layout.containerHeight
      });
    } catch (error) {
      console.error('Error calculating justified layout:', error);
      boxes = [];
    }
  }

  let galleryEl: HTMLDivElement;
  
  function resize() {
    if (galleryEl) {
      const newWidth = galleryEl.clientWidth;
      if (newWidth !== containerWidth && newWidth > 0) {
        containerWidth = newWidth;
      }
    }
  }
  
  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    
    // Also resize when images load
    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    
    if (galleryEl) {
      resizeObserver.observe(galleryEl);
    }
    
    return () => {
      window.removeEventListener('resize', resize);
      resizeObserver.disconnect();
    };
  });

  function handleImageClick(itemId: string) {
    location.href = `/image/${itemId}`;
  }

  function handleKeydown(event: KeyboardEvent, itemId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleImageClick(itemId);
    }
  }
</script>

<style>
  .gallery { 
    position: relative; 
    width: 100%;
    min-height: 200px;
    background: #0f1419;
    padding: 0;
    margin: 0;
  }
  .pic-container { 
    position: absolute; 
    cursor: pointer; 
    overflow: hidden;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .pic-container:focus {
    outline: 3px solid #0066cc;
    outline-offset: 2px;
  }
  .pic-container:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .pic { 
    width: 100%; 
    height: 100%; 
    object-fit: cover; 
    display: block;
    transition: all 0.3s ease;
  }
  .pic-container:hover .pic {
    filter: brightness(1.1) contrast(1.05);
  }
  .debug-info {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-family: monospace;
    z-index: 1000;
    pointer-events: none;
  }
</style>

<div bind:this={galleryEl}
     class="gallery"
     style="height:{layout.containerHeight}px;">
  

  
  {#if boxes.length > 0}
    {#each items as item, i}
      {#if boxes[i]}
        <div
          class="pic-container"
          role="button"
          tabindex="0"
          aria-label="View image {item.id}"
          style="
            left:{boxes[i].left}px;
            top:{boxes[i].top}px;
            width:{boxes[i].width}px;
            height:{boxes[i].height}px;
          "
          on:click={() => handleImageClick(item.id)}
          on:keydown={(e) => handleKeydown(e, item.id)}
        >
          <img
            class="pic"
            src={item.src}
            alt="Gallery image {item.id}"
            loading="lazy"
          />
        </div>
      {/if}
    {/each}
  {:else}
    <div style="padding: 40px; text-align: center; color: #666; font-size: 16px;">
      {items.length === 0 ? '📷 No images to display' : '⚙️ Calculating Adobe Stock-style layout...'}
    </div>
  {/if}
</div>
