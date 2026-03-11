<script lang="ts">
  import { onMount } from 'svelte';
  import { authFetch } from '$lib/authFetch';

  // Props
  export let profileId: string;

  // State
  let searchQuery = '';
  let searchResults: any[] = [];
  let selectedUser: any = null;
  let rights = {
    download: false,
    edit: false,
    delete: false
  };
  let existingRights: any[] = [];
  let loading = false;
  let searchLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  
  // Edit mode state
  let editingRights: any = null;
  let editRights = {
    download: false,
    edit: false,
    delete: false
  };

  // Debounced search
  let searchTimeout: number;

  onMount(() => {
    loadExistingRights();
  });

    async function loadExistingRights() {
    try {
      loading = true;
      const response = await authFetch('/api/profile-rights');
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Loaded profile rights:', data);
        existingRights = data.profileRights || [];
        
        // Lade Benutzernamen für die angezeigten Rechte
        for (let right of existingRights) {
          try {
            const userResponse = await authFetch(`/api/user-details/${right.target_user_id}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (userData.user) {
                right.userName = userData.user.full_name;
                right.userEmail = userData.user.email || '';
              }
            }
          } catch (error) {
            console.error('Error loading user details:', error);
          }
        }

        // Trigger a reactive update after enriching entries with user details.
        existingRights = [...existingRights];
      } else {
        showMessage('Fehler beim Laden der Rechte', 'error');
      }
    } catch (error) {
      console.error('Error loading rights:', error);
      showMessage('Fehler beim Laden der Rechte', 'error');
    } finally {
      loading = false;
    }
  }

  async function searchUsers() {
    if (searchQuery.length < 2) {
      searchResults = [];
      return;
    }

    try {
      searchLoading = true;
      const response = await authFetch(`/api/search-users?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        searchResults = data.users || [];
      } else {
        showMessage('Fehler bei der Benutzersuche', 'error');
      }
    } catch (error) {
      console.error('Error searching users:', error);
      showMessage('Fehler bei der Benutzersuche', 'error');
    } finally {
      searchLoading = false;
    }
  }

  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchUsers, 300);
  }

  function selectUser(user: any) {
    selectedUser = user;
    searchQuery = user.full_name;
    searchResults = [];
  }

  async function saveRights() {
    if (!selectedUser) {
      showMessage('Bitte wählen Sie einen Benutzer aus', 'error');
      return;
    }

    try {
      loading = true;
      const response = await authFetch('/api/profile-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          rights: rights
        })
      });

      if (response.ok) {
        showMessage('Rechte erfolgreich gespeichert', 'success');
        selectedUser = null;
        searchQuery = '';
        rights = { download: false, edit: false, delete: false };
        await loadExistingRights();
      } else {
        const data = await response.json();
        const errorMessage = data.error + (data.details ? `: ${data.details}` : '');
        showMessage(errorMessage || 'Fehler beim Speichern', 'error');
      }
    } catch (error) {
      console.error('Error saving rights:', error);
      showMessage('Fehler beim Speichern der Rechte', 'error');
    } finally {
      loading = false;
    }
  }

  async function deleteRights(targetUserId: string) {
    if (!confirm('Möchten Sie diese Rechte wirklich löschen?')) {
      return;
    }

    try {
      loading = true;
      const response = await authFetch('/api/profile-rights', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId })
      });

      if (response.ok) {
        showMessage('Rechte erfolgreich gelöscht', 'success');
        await loadExistingRights();
      } else {
        const data = await response.json();
        const errorMessage = data.error + (data.details ? `: ${data.details}` : '');
        showMessage(errorMessage || 'Fehler beim Löschen', 'error');
      }
    } catch (error) {
      console.error('Error deleting rights:', error);
      showMessage('Fehler beim Löschen der Rechte', 'error');
    } finally {
      loading = false;
    }
  }

  function startEditRights(right: any) {
    editingRights = right;
    editRights = { ...right.rights };
  }

  function cancelEditRights() {
    editingRights = null;
    editRights = { download: false, edit: false, delete: false };
  }

  async function saveEditRights() {
    if (!editingRights) return;

    try {
      loading = true;
      const response = await authFetch('/api/profile-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: editingRights.target_user_id,
          rights: editRights
        })
      });

      if (response.ok) {
        showMessage('Rechte erfolgreich aktualisiert', 'success');
        editingRights = null;
        editRights = { download: false, edit: false, delete: false };
        await loadExistingRights();
      } else {
        const data = await response.json();
        const errorMessage = data.error + (data.details ? `: ${data.details}` : '');
        showMessage(errorMessage || 'Fehler beim Aktualisieren', 'error');
      }
    } catch (error) {
      console.error('Error updating rights:', error);
      showMessage('Fehler beim Aktualisieren der Rechte', 'error');
    } finally {
      loading = false;
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function getRightsText(rights: any) {
    const permissions = [];
    if (rights.download) permissions.push('Download');
    if (rights.edit) permissions.push('Bearbeiten');
    if (rights.delete) permissions.push('Löschen');
    return permissions.length > 0 ? permissions.join(', ') : 'Keine Rechte';
  }
</script>

<div class="profile-rights-manager">
  <h3>Profilweite Rechte</h3>
  <p class="intro-text">Diese Freigaben gelten fuer alle Items deines Profils. Fuer einzelne Eintraege vergibst du Rechte direkt im jeweiligen Item.</p>
  
  {#if message}
    <div class="message {messageType}">
      {message}
    </div>
  {/if}

  <!-- Neue Rechte vergeben -->
  <div class="add-rights-section">
    <h4>Neue Freigabe anlegen</h4>
    
    <div class="search-section">
      <label for="user-search">Benutzer suchen</label>
      <input
        id="user-search"
        type="text"
        bind:value={searchQuery}
        on:input={handleSearchInput}
        placeholder="Name oder E-Mail eingeben..."
        disabled={loading}
      />
      
      {#if searchLoading}
        <div class="loading">Suche...</div>
      {/if}
      
      {#if searchResults.length > 0}
        <div class="search-results">
          {#each searchResults as user}
            <button 
              class="search-result" 
              on:click={() => selectUser(user)}
              on:keydown={(e) => e.key === 'Enter' && selectUser(user)}
              type="button"
            >
              <div class="user-name">{user.full_name}</div>
              <div class="user-email">{user.email}</div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if selectedUser}
      <div class="selected-user">
        <h5>Ausgewaehlter Benutzer</h5>
        <div class="user-info">
          <strong>{selectedUser.full_name}</strong>
          <span class="email">{selectedUser.email}</span>
        </div>
        
        <div class="rights-checkboxes">
          <label class="right-checkbox">
            <input type="checkbox" bind:checked={rights.download}>
            <span class="checkbox-label">Download fuer alle Items</span>
          </label>
          
          <label class="right-checkbox">
            <input type="checkbox" bind:checked={rights.edit}>
            <span class="checkbox-label">Bearbeiten fuer alle Items</span>
          </label>
          
          <label class="right-checkbox">
            <input type="checkbox" bind:checked={rights.delete}>
            <span class="checkbox-label">Loeschen fuer alle Items</span>
          </label>
        </div>
        
        <button 
          class="save-btn" 
          on:click={saveRights}
          disabled={loading}
        >
          {loading ? 'Speichere...' : 'Rechte speichern'}
        </button>
      </div>
    {/if}
  </div>

  <!-- Bestehende Rechte -->
  <div class="existing-rights-section">
    <h4>Bestehende Freigaben</h4>
    
    {#if loading}
      <div class="loading">Lade Rechte...</div>
    {:else if existingRights.length === 0}
      <div class="no-rights">Noch keine profilweiten Freigaben vorhanden</div>
    {:else}
      <div class="rights-list">
        {#each existingRights as right}
          <div class="right-item">
            {#if editingRights === right}
              <!-- Edit Mode -->
              <div class="user-info">
                <div class="user-name">{right.userName || `Benutzer ID: ${right.target_user_id}`}</div>
                <div class="user-email">{right.userEmail || 'Keine E-Mail verfügbar'}</div>
              </div>
              
              <div class="rights-edit">
                <div class="rights-checkboxes">
                  <label class="right-checkbox">
                    <input type="checkbox" bind:checked={editRights.download}>
                    <span class="checkbox-label">Download</span>
                  </label>
                  <label class="right-checkbox">
                    <input type="checkbox" bind:checked={editRights.edit}>
                    <span class="checkbox-label">Bearbeiten</span>
                  </label>
                  <label class="right-checkbox">
                    <input type="checkbox" bind:checked={editRights.delete}>
                    <span class="checkbox-label">Löschen</span>
                  </label>
                </div>
              </div>
              
              <div class="edit-buttons">
                <button 
                  class="save-btn" 
                  on:click={saveEditRights}
                  disabled={loading}
                >
                  {loading ? 'Speichere...' : 'Speichern'}
                </button>
                <button 
                  class="cancel-btn" 
                  on:click={cancelEditRights}
                  disabled={loading}
                >
                  Abbrechen
                </button>
              </div>
            {:else}
              <!-- View Mode -->
              <div class="user-info">
                <div class="user-name">{right.userName || `Benutzer ID: ${right.target_user_id}`}</div>
                <div class="user-email">{right.userEmail || 'Keine E-Mail verfügbar'}</div>
              </div>
              
                          <div class="rights-info">
              <div class="rights-text">{getRightsText(right.rights)}</div>
              <div class="rights-date">
                Erstellt: {new Date(right.created_at).toLocaleDateString('de-DE')}
              </div>
            </div>
              
              <div class="action-buttons">
                <button 
                  class="edit-btn" 
                  on:click={() => startEditRights(right)}
                  disabled={loading}
                >
                  Bearbeiten
                </button>
                <button 
                  class="delete-btn" 
                  on:click={() => deleteRights(right.target_user_id)}
                  disabled={loading}
                >
                  Löschen
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .profile-rights-manager {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
  }

  h3 {
    color: var(--text-primary);
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.03em;
  }

  h4 {
    color: var(--text-primary);
    margin: 0 0 1rem;
    font-size: 1.05rem;
  }

  h5 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
  }

  .intro-text {
    margin: -0.75rem 0 0;
    color: var(--text-secondary);
    line-height: 1.6;
    max-width: 68ch;
  }

  .message {
    padding: 0.9rem 1rem;
    border-radius: 16px;
    margin-bottom: 0;
    border: 1px solid transparent;
  }

  .message.success {
    background: color-mix(in srgb, #d4edda 28%, transparent);
    color: #c9ffd6;
    border-color: rgba(149, 214, 168, 0.35);
  }

  .message.error {
    background: color-mix(in srgb, #f8d7da 24%, transparent);
    color: #ffd3d6;
    border-color: rgba(245, 198, 203, 0.35);
  }

  .add-rights-section,
  .existing-rights-section {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 100%), var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--border-color) 85%, white 7%);
  }

  .search-section {
    position: relative;
    margin-bottom: 1.25rem;
  }

  label {
    display: block;
    margin-bottom: 0.55rem;
    color: var(--text-primary);
    font-weight: 600;
  }

  input[type="text"] {
    width: 100%;
    padding: 0.95rem 1rem;
    border: 1px solid color-mix(in srgb, var(--border-color) 85%, white 8%);
    border-radius: 16px;
    background: color-mix(in srgb, var(--bg-primary) 88%, #0f1723 12%);
    color: var(--text-primary);
    font-size: 1rem;
    box-sizing: border-box;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 4px rgba(238, 114, 33, 0.16);
  }

  .loading {
    color: var(--text-secondary);
    margin: 0.5rem 0;
  }

  .search-results {
    margin-top: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--border-color) 85%, white 8%);
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg-primary) 92%, #0f1723 8%);
    max-height: 200px;
    overflow-y: auto;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  }

  .search-result {
    padding: 0.9rem 1rem;
    cursor: pointer;
    border-bottom: 1px solid color-mix(in srgb, var(--border-color) 75%, transparent);
    transition: background 0.2s, transform 0.2s;
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    background: none;
    border: none;
  }

  .search-result:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .search-result:last-child {
    border-bottom: none;
  }

  .user-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .user-email {
    font-size: 0.92rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
    word-break: break-word;
  }

  .selected-user {
    background: color-mix(in srgb, var(--bg-primary) 85%, #0f1723 15%);
    padding: 1.1rem;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, white 7%);
  }

  .rights-checkboxes {
    display: grid;
    gap: 0.75rem;
    margin: 1rem 0 1.2rem;
  }

  .right-checkbox {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.9rem 1rem;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .right-checkbox input[type="checkbox"] {
    width: auto;
    margin: 0;
    accent-color: var(--culoca-orange);
  }

  .checkbox-label {
    color: var(--text-primary);
    line-height: 1.45;
  }

  .save-btn {
    background: linear-gradient(135deg, var(--culoca-orange) 0%, #f39c4c 100%);
    color: white;
    border: none;
    padding: 0.85rem 1.25rem;
    border-radius: 14px;
    cursor: pointer;
    font-size: 0.98rem;
    font-weight: 700;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .save-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(238, 114, 33, 0.28);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .no-rights {
    color: var(--text-secondary);
    text-align: center;
    padding: 2rem 1rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
  }

  .rights-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .right-item {
    background: color-mix(in srgb, var(--bg-primary) 84%, #101822 16%);
    padding: 1rem 1.1rem;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, white 8%);
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
  }

  .rights-info {
    min-width: 0;
  }

  .rights-text {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .rights-date {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .delete-btn {
    background: rgba(220, 53, 69, 0.14);
    color: white;
    border: 1px solid rgba(220, 53, 69, 0.24);
    padding: 0.7rem 1rem;
    border-radius: 14px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: transform 0.2s, background 0.2s;
  }

  .delete-btn:hover:not(:disabled) {
    background: rgba(220, 53, 69, 0.22);
    transform: translateY(-1px);
  }

  .delete-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .edit-btn {
    background: rgba(255, 255, 255, 0.06);
    color: white;
    border: 1px solid color-mix(in srgb, var(--border-color) 75%, white 8%);
    padding: 0.7rem 1rem;
    border-radius: 14px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: transform 0.2s, background 0.2s;
  }

  .edit-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .edit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.06);
    color: white;
    border: 1px solid color-mix(in srgb, var(--border-color) 75%, white 8%);
    padding: 0.7rem 1rem;
    border-radius: 14px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: transform 0.2s, background 0.2s;
  }

  .cancel-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .edit-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .rights-edit {
    min-width: 0;
  }

  @media (max-width: 768px) {
    .right-item {
      grid-template-columns: 1fr;
      align-items: stretch;
      gap: 1rem;
    }

    .action-buttons,
    .edit-buttons {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
