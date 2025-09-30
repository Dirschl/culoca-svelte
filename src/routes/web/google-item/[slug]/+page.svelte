<script lang="ts">
  import type { PageData } from './$types';
  
  export let data: PageData;
  
  const { item } = data;
</script>

<svelte:head>
  <title>{item.title || 'Culoca Item'} - Google Earth View</title>
  <meta name="description" content="Culoca Item: {item.description || item.title || 'GPS-gebundenes Foto'}">
  <meta name="robots" content="noindex, nofollow">
</svelte:head>

<!-- Google Earth optimierte Seite - nur HTML, kein CSS/JavaScript -->
<div style="font-family: Arial, sans-serif; width: 100%; margin: 0 auto; padding: 20px; text-align: center; background: white; min-height: 100vh;">
  
  <!-- Hauptbild zentriert -->
  {#if item.path_2048}
    <div style="margin-bottom: 15px; text-align: center;">
      <a href={item.culoca_url} target="_blank" style="text-decoration: none;">
        <img 
          src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/{item.path_2048}" 
          alt={item.title || 'Culoca Item'}
          style="max-height: 800px; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: block; margin: 0 auto;"
        />
      </a>
    </div>
    
    <!-- Dezenter Hinweis direkt unter dem Bild -->
    <p style="color: #999; font-size: 12px; margin-bottom: 15px; font-style: italic; text-align: center;">
      {new Date(item.created_at).toLocaleDateString('de-DE')}, {item.creator}
    </p>
  {/if}

  <!-- Titel -->
  {#if item.title}
    <h1 style="color: #333; font-size: 24px; margin-bottom: 15px; font-weight: bold;">
      {item.title}
    </h1>
  {/if}

  <!-- Caption (falls vorhanden und verschieden vom Titel) -->
  {#if item.caption && item.caption !== item.title}
    <p style="color: #666; font-style: italic; font-size: 18px; margin-bottom: 20px; text-align: center;">
      {item.caption}
    </p>
  {/if}

  <!-- Description -->
  {#if item.description}
    <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px; text-align: center; padding: 0 20px;">
      {item.description}
    </p>
  {/if}


  <!-- Culoca Button -->
  <div style="margin-top: 30px;">
    <a 
      href={item.culoca_url} 
      target="_blank"
      style="
        display: inline-block;
        background: #ff6600;
        color: white;
        padding: 15px 30px;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(255, 102, 0, 0.3);
        transition: background 0.2s;
      "
      onmouseover="this.style.background='#e55a00'"
      onmouseout="this.style.background='#ff6600'"
    >
      Jetzt zu Culoca wechseln
    </a>
  </div>


</div>
