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
                right.userEmail = userData.user.email;
              }
            }
          } catch (error) {
            console.error('Error loading user details:', error);
          }
        }
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
  <h3>Rechte für andere Benutzer verwalten</h3>
  
  {#if message}
    <div class="message {messageType}">
      {message}
    </div>
  {/if}

  <!-- Neue Rechte vergeben -->
  <div class="add-rights-section">
    <h4>Neue Rechte vergeben</h4>
    
    <div class="search-section">
      <label for="user-search">Benutzer suchen:</label>
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
        <h5>Ausgewählter Benutzer:</h5>
        <div class="user-info">
          <strong>{selectedUser.full_name}</strong>
          <span class="email">{selectedUser.email}</span>
        </div>
        
        <div class="rights-checkboxes">
          <label class="right-checkbox">
            <input type="checkbox" bind:checked={rights.download}>
            <span class="checkbox-label">Download erlauben</span>
          </label>
          
          <label class="right-checkbox">
            <input type="checkbox" bind:checked={rights.edit}>
            <span class="checkbox-label">Bearbeiten erlauben</span>
          </label>
          
          <label class="right-checkbox">
            <input type="checkbox" bind:checked={rights.delete}>
            <span class="checkbox-label">Löschen erlauben</span>
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
    <h4>Bestehende Rechte</h4>
    
    {#if loading}
      <div class="loading">Lade Rechte...</div>
    {:else if existingRights.length === 0}
      <div class="no-rights">Noch keine Rechte vergeben</div>
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
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
  }

  h3 {
    color: var(--text-primary);
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  h4 {
    color: var(--text-primary);
    margin: 1.5rem 0 1rem 0;
  }

  .message {
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .add-rights-section {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .search-section {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  input[type="text"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(238, 114, 33, 0.2);
  }

  .loading {
    color: var(--text-secondary);
    font-style: italic;
    margin: 0.5rem 0;
  }

  .search-results {
    margin-top: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    max-height: 200px;
    overflow-y: auto;
  }

  .search-result {
    padding: 0.75rem;
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
    transition: background 0.2s;
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    background: none;
    border: none;
  }

  .search-result:hover {
    background: var(--bg-secondary);
  }

  .search-result:last-child {
    border-bottom: none;
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .user-email {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .selected-user {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .rights-checkboxes {
    margin: 1rem 0;
  }

  .right-checkbox {
    display: flex;
    align-items: center;
    margin: 0.5rem 0;
    cursor: pointer;
  }

  .right-checkbox input[type="checkbox"] {
    margin-right: 0.5rem;
    width: auto;
  }

  .checkbox-label {
    color: var(--text-primary);
  }

  .save-btn {
    background: var(--accent-color);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  .save-btn:hover:not(:disabled) {
    background: #d65a1a;
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .existing-rights-section {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
  }

  .no-rights {
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  .rights-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .right-item {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rights-info {
    flex: 1;
    margin: 0 1rem;
  }

  .rights-text {
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .rights-date {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .delete-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .delete-btn:hover:not(:disabled) {
    background: #c82333;
  }

  .delete-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .edit-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
    margin-right: 0.5rem;
  }

  .edit-btn:hover:not(:disabled) {
    background: #0056b3;
  }

  .edit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
    margin-left: 0.5rem;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #545b62;
  }

  .cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .edit-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .rights-edit {
    flex: 1;
    margin: 0 1rem;
  }

  @media (max-width: 768px) {
    .right-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .rights-info {
      margin: 0;
    }

    .rights-edit {
      margin: 0;
    }

    .action-buttons,
    .edit-buttons {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
