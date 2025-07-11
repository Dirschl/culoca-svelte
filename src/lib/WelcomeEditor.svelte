<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  
  export let visible = false;
  export let onClose: () => void;
  export let onSave: () => void;
  
  let welcomeContent: any[] = [];
  let loading = false;
  let saving = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  
  // Local content copies for editing
  let greetingTitle = '';
  let greetingContent = '';
  let gpsTitle = '';
  let gpsContent = '';
  let discoverTitle = '';
  let discoverContent = '';
  
  onMount(async () => {
    if (visible) {
      await loadWelcomeContent();
    }
  });
  
  $: if (visible) {
    loadWelcomeContent();
  }
  
  async function loadWelcomeContent() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('welcome_content')
        .select('*')
        .eq('is_active', true)
        .order('id');
      
      if (error) {
        console.error('Database error:', error);
        // Fall back to default values
        setDefaultValues();
        return;
      }
      
      welcomeContent = data || [];
      
      // Map content to local variables
      const greeting = welcomeContent.find(item => item.section_key === 'greeting');
      const gps = welcomeContent.find(item => item.section_key === 'gps_feature');
      const discover = welcomeContent.find(item => item.section_key === 'discover');
      
      greetingTitle = greeting?.title || 'Hallo {userName}! 👋';
      greetingContent = greeting?.content || 'Willkommen bei <strong>Culoca</strong> – deiner GPS-basierten Foto-Community!<br><br>Du nutzt die <span class="beta-badge">Beta-Version</span>. Wir haben viele Ideen, lass dich überraschen! 🚀';
      gpsTitle = gps?.title || 'GPS zeigt dir was du willst';
      gpsContent = gps?.content || 'Entdecke <strong>Fotos genau dort</strong>, wo du gerade bist oder hinfahren möchtest.<br><br>Deine Kamera kennt bereits jeden Ort – wir machen ihn für andere sichtbar.';
      discoverTitle = discover?.title || 'Entdecke deine Region';
      discoverContent = discover?.content || 'Sieh deine Umgebung mit <strong>neuen Augen</strong>. Versteckte Schätze, bekannte Orte, unentdeckte Perspektiven.<br><br>Teile deine schönsten Momente und inspiriere andere Fotografen.';
      
    } catch (error) {
      console.error('Error loading welcome content:', error);
      setDefaultValues();
      showMessage('Verwende Standard-Inhalte (Datenbank nicht verfügbar)', 'error');
    } finally {
      loading = false;
    }
  }
  
  function setDefaultValues() {
    greetingTitle = 'Hallo {userName}! 👋';
    greetingContent = 'Willkommen bei <strong>Culoca</strong> – deiner GPS-basierten Foto-Community!<br><br>Du nutzt die <span class="beta-badge">Beta-Version</span>. Wir haben viele Ideen, lass dich überraschen! 🚀';
    gpsTitle = 'GPS zeigt dir was du willst';
    gpsContent = 'Entdecke <strong>Fotos genau dort</strong>, wo du gerade bist oder hinfahren möchtest.<br><br>Deine Kamera kennt bereits jeden Ort – wir machen ihn für andere sichtbar.';
    discoverTitle = 'Entdecke deine Region';
    discoverContent = 'Sieh deine Umgebung mit <strong>neuen Augen</strong>. Versteckte Schätze, bekannte Orte, unentdeckte Perspektiven.<br><br>Teile deine schönsten Momente und inspiriere andere Fotografen.';
  }
  
  async function saveWelcomeContent() {
    saving = true;
    try {
      const updates = [
        { section_key: 'greeting', title: greetingTitle, content: greetingContent },
        { section_key: 'gps_feature', title: gpsTitle, content: gpsContent },
        { section_key: 'discover', title: discoverTitle, content: discoverContent }
      ];
      
      for (const update of updates) {
        const { error } = await supabase
          .from('welcome_content')
          .upsert(update, { onConflict: 'section_key' });
        
        if (error) throw error;
      }
      
      showMessage('Willkommens-Inhalte erfolgreich gespeichert!', 'success');
      onSave();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error saving welcome content:', error);
      showMessage('Fehler beim Speichern der Inhalte', 'error');
    } finally {
      saving = false;
    }
  }
  
  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }
  
  function insertVariable(textareaId: string, variable: string) {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + variable + after;
      
      // Update the corresponding content variable
      if (textareaId === 'greeting-content') greetingContent = newText;
      else if (textareaId === 'gps-content') gpsContent = newText;
      else if (textareaId === 'discover-content') discoverContent = newText;
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  }
</script>

{#if visible}
  <div class="editor-overlay">
    <div class="editor-content">
      <div class="editor-header">
        <h2>🎯 Welcome Section Editor</h2>
        <button class="close-btn" on:click={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      
      {#if message}
        <div class="message {messageType}">
          {message}
        </div>
      {/if}
      
      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <span>Lade Inhalte...</span>
        </div>
      {:else}
        <div class="editor-body">
          <div class="variables-info">
            <h3>📝 Verfügbare Variablen:</h3>
                         <div class="variable-buttons">
               <button class="var-btn" on:click={() => insertVariable('greeting-content', '{userName}')}>
                 {'{userName}'}
               </button>
               <button class="var-btn" on:click={() => insertVariable('gps-content', '{userName}')}>
                 {'{userName}'}
               </button>
               <button class="var-btn" on:click={() => insertVariable('discover-content', '{userName}')}>
                 {'{userName}'}
               </button>
             </div>
            <p class="variables-note">
              HTML-Tags sind erlaubt: <code>&lt;strong&gt;</code>, <code>&lt;br&gt;</code>, <code>&lt;span class="beta-badge"&gt;</code>
            </p>
          </div>
          
          <!-- Section 1: Greeting -->
          <div class="section-editor">
            <h3>👋 Begrüßungssektion</h3>
            <div class="field-group">
              <label for="greeting-title">Titel:</label>
              <input 
                id="greeting-title"
                type="text" 
                bind:value={greetingTitle}
                                 placeholder="z.B. Hallo {'{userName}'}! 👋"
              />
            </div>
            <div class="field-group">
              <label for="greeting-content">Inhalt:</label>
              <textarea 
                id="greeting-content"
                bind:value={greetingContent}
                rows="4"
                placeholder="Willkommensnachricht..."
              ></textarea>
                             <button class="var-insert-btn" on:click={() => insertVariable('greeting-content', '{userName}')}>
                 + {'{userName}'} einfügen
               </button>
            </div>
          </div>
          
          <!-- Section 2: GPS Feature -->
          <div class="section-editor">
            <h3>🗺️ GPS-Feature Sektion</h3>
            <div class="field-group">
              <label for="gps-title">Titel:</label>
              <input 
                id="gps-title"
                type="text" 
                bind:value={gpsTitle}
                placeholder="z.B. GPS zeigt dir was du willst"
              />
            </div>
            <div class="field-group">
              <label for="gps-content">Inhalt:</label>
              <textarea 
                id="gps-content"
                bind:value={gpsContent}
                rows="4"
                placeholder="Beschreibung der GPS-Funktionen..."
              ></textarea>
                             <button class="var-insert-btn" on:click={() => insertVariable('gps-content', '{userName}')}>
                 + {'{userName}'} einfügen
               </button>
            </div>
          </div>
          
          <!-- Section 3: Discover -->
          <div class="section-editor">
            <h3>🔍 Entdecken Sektion</h3>
            <div class="field-group">
              <label for="discover-title">Titel:</label>
              <input 
                id="discover-title"
                type="text" 
                bind:value={discoverTitle}
                placeholder="z.B. Entdecke deine Region"
              />
            </div>
            <div class="field-group">
              <label for="discover-content">Inhalt:</label>
              <textarea 
                id="discover-content"
                bind:value={discoverContent}
                rows="4"
                placeholder="Beschreibung des Entdeckens..."
              ></textarea>
                             <button class="var-insert-btn" on:click={() => insertVariable('discover-content', '{userName}')}>
                 + {'{userName}'} einfügen
               </button>
            </div>
          </div>
          
          <!-- Preview -->
          <div class="preview-section">
            <h3>👀 Vorschau</h3>
            <div class="preview-content">
              <div class="welcome-preview">
                <div class="preview-grid">
                  <div class="preview-column">
                    <h4>{@html greetingTitle.replace('{userName}', 'Max Mustermann')}</h4>
                    <div class="preview-text">{@html greetingContent.replace('{userName}', 'Max Mustermann')}</div>
                  </div>
                  <div class="preview-column">
                    <h4>{@html gpsTitle.replace('{userName}', 'Max Mustermann')}</h4>
                    <div class="preview-text">{@html gpsContent.replace('{userName}', 'Max Mustermann')}</div>
                  </div>
                  <div class="preview-column">
                    <h4>{@html discoverTitle.replace('{userName}', 'Max Mustermann')}</h4>
                    <div class="preview-text">{@html discoverContent.replace('{userName}', 'Max Mustermann')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="editor-footer">
          <button class="cancel-btn" on:click={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button class="save-btn" on:click={saveWelcomeContent} disabled={saving}>
            {#if saving}
              <div class="spinner"></div>
              Speichern...
            {:else}
              💾 Speichern
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .editor-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .editor-content {
    background: var(--bg-secondary);
    border-radius: 12px;
    max-width: 1200px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px var(--shadow);
    border: 1px solid var(--border-color);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: #4b5563;
    color: white;
    border-radius: 12px 12px 0 0;
  }

  .editor-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .message {
    margin: 1rem 1.5rem;
    padding: 1rem;
    border-radius: 8px;
    font-weight: 500;
  }

  .message.success {
    background: #10b981;
    color: white;
  }

  .message.error {
    background: #ef4444;
    color: white;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .editor-body {
    padding: 1.5rem;
  }

  .variables-info {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 2rem;
  }

  .variables-info h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .variable-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .var-btn {
    background: #4b5563;
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .var-btn:hover {
    background: #374151;
  }

  .variables-note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .variables-note code {
    background: var(--bg-primary);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .section-editor {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .section-editor h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .field-group {
    margin-bottom: 1rem;
    position: relative;
  }

  .field-group:last-child {
    margin-bottom: 0;
  }

  .field-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .field-group input,
  .field-group textarea {
    width: 100%;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.75rem;
    font-size: 0.9rem;
    line-height: 1.4;
    resize: vertical;
  }

  .field-group input:focus,
  .field-group textarea:focus {
    outline: none;
    border-color: #4b5563;
    box-shadow: 0 0 0 2px rgba(75, 85, 99, 0.2);
  }

  .var-insert-btn {
    position: absolute;
    top: 1.8rem;
    right: 0.5rem;
    background: #4b5563;
    color: white;
    border: none;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .var-insert-btn:hover {
    background: #374151;
  }

  .preview-section {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .preview-section h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .welcome-preview {
    background: #4b5563;
    color: white;
    padding: 1.5rem;
    border-radius: 8px;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }

  .preview-column {
    text-align: center;
  }

  .preview-column h4 {
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0 0 0.75rem 0;
    color: white;
  }

  .preview-text {
    font-size: 0.9rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.95);
  }

  :global(.preview-text .beta-badge) {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-tertiary);
    border-radius: 0 0 12px 12px;
    gap: 1rem;
  }

  .cancel-btn,
  .save-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cancel-btn {
    background: var(--bg-primary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .cancel-btn:hover:not(:disabled) {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .save-btn {
    background: #4b5563;
    color: white;
    border: none;
  }

  .save-btn:hover:not(:disabled) {
    background: #374151;
    transform: translateY(-1px);
  }

  .save-btn:disabled,
  .cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .editor-content {
      margin: 0.5rem;
      max-height: 95vh;
    }

    .editor-header,
    .editor-body,
    .editor-footer {
      padding: 1rem;
    }

    .preview-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .editor-footer {
      flex-direction: column;
    }

    .cancel-btn,
    .save-btn {
      width: 100%;
      justify-content: center;
    }

    .var-insert-btn {
      position: static;
      margin-top: 0.5rem;
      width: 100%;
    }
  }
</style> 