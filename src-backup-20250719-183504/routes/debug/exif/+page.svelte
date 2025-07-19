<script lang="ts">
  import * as exifr from 'exifr';
  
  let dragOver = false;
  let isProcessing = false;
  let exifData: any = null;
  let fileName = '';
  let allExifKeys: string[] = [];
  let titleRelevantFields: Array<{key: string, value: any}> = [];
  let iptcFields: Array<{key: string, value: any}> = [];
  let rawExifData: any = null;
  let fileSize = '';
  let imageDimensions = '';

  // Helper: fix IPTC strings that were decoded as Latin-1 instead of UTF-8
  function fixEncodingLocal(str: string | null): string {
    if (!str) return '';
    try {
      // Check if it looks like it was decoded as Latin-1 but is actually UTF-8
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return str;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  }

  async function processFile(file: File) {
    isProcessing = true;
    fileName = file.name;
    fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    
    try {
      // Read all possible EXIF data
      const data = await exifr.parse(file, {
        tiff: true,
        ifd0: true,
        ifd1: true,
        exif: true,
        gps: true,
        interop: true,
        iptc: true,
        icc: true,
        jfif: true,
        ihdr: true,
        mpeg1: true,
        mpeg4: true,
        mpegps: true,
        sanitize: false,
        reviveValues: false,
        translateKeys: false,
        translateValues: false,
        mergeOutput: false
      });

      rawExifData = data;
      exifData = data;
      
      if (data) {
        // Get all keys
        allExifKeys = Object.keys(data).sort();
        
        // Find title-relevant fields
        titleRelevantFields = [];
        iptcFields = [];
        
        for (const [key, value] of Object.entries(data)) {
          const keyLower = key.toLowerCase();
          
          // IPTC fields
          if (key.startsWith('IPTC:') || keyLower.includes('iptc')) {
            iptcFields.push({key, value});
          }
          
          // Title/headline/description relevant fields
          if (keyLower.includes('title') || 
              keyLower.includes('headline') || 
              keyLower.includes('objectname') || 
              keyLower.includes('description') ||
              keyLower.includes('caption') ||
              keyLower.includes('subject') ||
              keyLower.includes('imagedescription') ||
              key === 'ImageDescription' ||
              key === 'IPTC:Headline' ||
              key === 'IPTC:ObjectName' ||
              key === 'IPTC:Caption-Abstract') {
            titleRelevantFields.push({key, value});
          }
        }
        
        // Sort by relevance
        titleRelevantFields.sort((a, b) => {
          const priority = [
            'IPTC:Headline',
            'IPTC:ObjectName', 
            'ImageDescription',
            'IPTC:Caption-Abstract'
          ];
          const aIndex = priority.indexOf(a.key);
          const bIndex = priority.indexOf(b.key);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.key.localeCompare(b.key);
        });
        
        iptcFields.sort((a, b) => a.key.localeCompare(b.key));
        
        // Get image dimensions
        if (data.ImageWidth && data.ImageHeight) {
          imageDimensions = `${data.ImageWidth} × ${data.ImageHeight}`;
        } else if (data.ExifImageWidth && data.ExifImageHeight) {
          imageDimensions = `${data.ExifImageWidth} × ${data.ExifImageHeight}`;
        }
      }
      
    } catch (error) {
      console.error('EXIF parsing error:', error);
      exifData = { error: error.message };
    }
    
    isProcessing = false;
  }

  function formatValue(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<svelte:head>
  <title>EXIF Debug Tool - Culoca</title>
</svelte:head>

<main class="container">
  <header class="header">
    <h1>🔍 EXIF Debug Tool</h1>
    <p>Lade ein Bild hoch, um alle EXIF/IPTC-Metadaten zu analysieren</p>
  </header>

  <!-- File Upload Area -->
  <div 
    class="upload-area"
    class:drag-over={dragOver}
    on:drop={handleDrop}
    on:dragover|preventDefault={() => dragOver = true}
    on:dragleave={() => dragOver = false}
    on:dragenter|preventDefault
  >
    {#if isProcessing}
      <div class="processing">
        <div class="spinner"></div>
        <p>Analysiere EXIF-Daten...</p>
      </div>
    {:else}
      <div class="upload-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
        <h3>Bild hier ablegen oder klicken</h3>
        <p>Unterstützt: JPG, PNG, TIFF, HEIF, etc.</p>
        <input 
          type="file" 
          accept="image/*" 
          on:change={handleFileSelect}
          class="file-input"
        />
      </div>
    {/if}
  </div>

  {#if exifData && !isProcessing}
    <div class="results">
      <!-- File Info -->
      <section class="section">
        <h2>📁 Datei-Informationen</h2>
        <div class="info-grid">
          <div><strong>Name:</strong> {fileName}</div>
          <div><strong>Größe:</strong> {fileSize}</div>
          {#if imageDimensions}
            <div><strong>Abmessungen:</strong> {imageDimensions}</div>
          {/if}
        </div>
      </section>

      <!-- Title-relevant Fields -->
      {#if titleRelevantFields.length > 0}
        <section class="section priority">
          <h2>🎯 Title-relevante Felder</h2>
          <p class="section-desc">Diese Felder werden für die Titel-Ermittlung verwendet:</p>
          <div class="field-list">
            {#each titleRelevantFields as field, i}
              <div class="field-item {i === 0 ? 'primary' : ''}">
                <div class="field-header">
                  <span class="field-key">{field.key}</span>
                  {#if i === 0}
                    <span class="badge primary">HÖCHSTE PRIORITÄT</span>
                  {/if}
                  <button 
                    class="copy-btn" 
                    on:click={() => copyToClipboard(formatValue(field.value))}
                    title="Wert kopieren"
                  >
                    📋
                  </button>
                </div>
                <div class="field-value">
                  <code>{formatValue(field.value)}</code>
                </div>
                <div class="field-encoding">
                  <small>UTF-8 korrigiert: <code>{fixEncodingLocal(String(field.value))}</code></small>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- IPTC Fields -->
      {#if iptcFields.length > 0}
        <section class="section">
          <h2>📝 IPTC-Felder</h2>
          <p class="section-desc">Alle gefundenen IPTC-Metadaten:</p>
          <div class="field-list">
            {#each iptcFields as field}
              <div class="field-item">
                <div class="field-header">
                  <span class="field-key">{field.key}</span>
                  <button 
                    class="copy-btn" 
                    on:click={() => copyToClipboard(formatValue(field.value))}
                    title="Wert kopieren"
                  >
                    📋
                  </button>
                </div>
                <div class="field-value">
                  <code>{formatValue(field.value)}</code>
                </div>
                <div class="field-encoding">
                  <small>UTF-8 korrigiert: <code>{fixEncodingLocal(String(field.value))}</code></small>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- All EXIF Data -->
      <section class="section">
        <h2>🗂️ Alle EXIF-Daten ({allExifKeys.length} Felder)</h2>
        <div class="actions">
          <button 
            class="copy-btn large" 
            on:click={() => copyToClipboard(JSON.stringify(exifData, null, 2))}
          >
            📋 Alle Daten kopieren
          </button>
        </div>
        <div class="all-fields">
          {#each allExifKeys as key}
            <div class="field-item small">
              <div class="field-header">
                <span class="field-key">{key}</span>
                <button 
                  class="copy-btn" 
                  on:click={() => copyToClipboard(formatValue(exifData[key]))}
                  title="Wert kopieren"
                >
                  📋
                </button>
              </div>
              <div class="field-value">
                <code>{formatValue(exifData[key])}</code>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- Raw JSON -->
      <section class="section">
        <h2>🔍 Raw JSON Output</h2>
        <div class="json-output">
          <pre><code>{JSON.stringify(exifData, null, 2)}</code></pre>
        </div>
      </section>
    </div>
  {/if}
</main>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem 0;
    color: #1a1a1a;
  }

  .header p {
    color: #666;
    font-size: 1.1rem;
  }

  .upload-area {
    border: 3px dashed #ccc;
    border-radius: 12px;
    padding: 3rem;
    text-align: center;
    transition: all 0.3s ease;
    position: relative;
    margin-bottom: 2rem;
  }

  .upload-area.drag-over {
    border-color: #0066cc;
    background: #f0f8ff;
  }

  .upload-content svg {
    opacity: 0.5;
    margin-bottom: 1rem;
  }

  .upload-content h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
  }

  .upload-content p {
    color: #666;
    margin: 0;
  }

  .file-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border: 1px solid #e5e5e5;
  }

  .section.priority {
    border-left: 4px solid #0066cc;
    background: linear-gradient(to right, #f8fbff, white);
  }

  .section h2 {
    margin: 0 0 1rem 0;
    color: #1a1a1a;
    font-size: 1.5rem;
  }

  .section-desc {
    margin: 0 0 1rem 0;
    color: #666;
    font-style: italic;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .field-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-item {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid #e9ecef;
  }

  .field-item.primary {
    background: linear-gradient(135deg, #e3f2fd, #f8f9fa);
    border-color: #0066cc;
  }

  .field-item.small {
    padding: 0.5rem;
  }

  .field-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .field-key {
    font-weight: 600;
    color: #0066cc;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.9rem;
  }

  .badge {
    background: #0066cc;
    color: white;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .copy-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.2rem 0.4rem;
    cursor: pointer;
    font-size: 0.8rem;
    margin-left: auto;
  }

  .copy-btn:hover {
    background: #f0f0f0;
  }

  .copy-btn.large {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
  }

  .field-value {
    margin-bottom: 0.5rem;
  }

  .field-value code {
    background: white;
    padding: 0.5rem;
    border-radius: 4px;
    display: block;
    border: 1px solid #e9ecef;
    font-size: 0.85rem;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .field-encoding {
    opacity: 0.7;
  }

  .field-encoding code {
    background: #fff3cd;
    border-color: #ffeaa7;
  }

  .all-fields {
    max-height: 600px;
    overflow-y: auto;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 1rem;
  }

  .json-output {
    max-height: 400px;
    overflow: auto;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .json-output pre {
    margin: 0;
    padding: 1rem;
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .actions {
    margin-bottom: 1rem;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }
    
    .upload-area {
      padding: 2rem 1rem;
    }
    
    .section {
      padding: 1rem;
    }
    
    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 