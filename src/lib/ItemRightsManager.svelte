<script lang="ts">
  import { onMount } from 'svelte';
  import { authFetch } from '$lib/authFetch';

  export let itemId: string;
  export let itemTitle: string;

  let searchQuery = '';
  let searchResults: any[] = [];
  let searchLoading = false;
  let selectedUser: any = null;
  let loading = false;
  let message = '';
  let messageType = 'info';
  let existingRights: any[] = [];

  let rights = {
    download: false,
    edit: false,
    delete: false
  };

  let searchTimeout: NodeJS.Timeout;
  let editingRights: any = null;
  let editRights: any = { download: false, edit: false, delete: false };

  onMount(() => {
    loadExistingRights();
  });

  async function loadExistingRights() {
    try {
      loading = true;
      const response = await authFetch(`/api/item-rights/${itemId}`);
      
      if (response.ok) {
        const data = await response.json();
        existingRights = data.itemRights || [];
        
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
        console.error('Failed to load item rights');
      }
    } catch (error) {
      console.error('Error loading item rights:', error);
    } finally {
      loading = false;
    }
  }

  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchUsers, 300);
  }

  async function searchUsers() {
    if (!searchQuery || searchQuery.length < 2) {
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
        searchResults = [];
      }
    } catch (error) {
      console.error('Error searching users:', error);
      searchResults = [];
    } finally {
      searchLoading = false;
    }
  }

  function selectUser(user: any) {
    selectedUser = user;
    searchResults = [];
    searchQuery = '';
  }

  async function saveRights() {
    if (!selectedUser || (!rights.download && !rights.edit && !rights.delete)) {
      message = 'Bitte wählen Sie einen Benutzer und mindestens ein Recht aus.';
      messageType = 'error';
      return;
    }

    try {
      loading = true;
      const response = await authFetch(`/api/item-rights/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          rights: rights
        })
      });

      if (response.ok) {
        const data = await response.json();
        message = 'Rechte erfolgreich gespeichert!';
        messageType = 'success';
        selectedUser = null;
        rights = { download: false, edit: false, delete: false };
        await loadExistingRights();
      } else {
        const errorData = await response.json();
        message = errorData.error || 'Fehler beim Speichern der Rechte';
        messageType = 'error';
      }
    } catch (error) {
      console.error('Error saving rights:', error);
      message = 'Fehler beim Speichern der Rechte';
      messageType = 'error';
    } finally {
      loading = false;
    }
  }

  async function deleteRights(targetUserId: string) {
    try {
      loading = true;
      const response = await authFetch(`/api/item-rights/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId })
      });

      if (response.ok) {
        message = 'Rechte erfolgreich gelöscht!';
        messageType = 'success';
        await loadExistingRights();
      } else {
        const errorData = await response.json();
        message = errorData.error || 'Fehler beim Löschen der Rechte';
        messageType = 'error';
      }
    } catch (error) {
      console.error('Error deleting rights:', error);
      message = 'Fehler beim Löschen der Rechte';
      messageType = 'error';
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
      const response = await authFetch(`/api/item-rights/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: editingRights.target_user_id,
          rights: editRights
        })
      });

      if (response.ok) {
        message = 'Rechte erfolgreich aktualisiert!';
        messageType = 'success';
        editingRights = null;
        editRights = { download: false, edit: false, delete: false };
        await loadExistingRights();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error + (errorData.details ? `: ${errorData.details}` : '');
        message = errorMessage || 'Fehler beim Aktualisieren';
        messageType = 'error';
      }
    } catch (error) {
      console.error('Error updating rights:', error);
      message = 'Fehler beim Aktualisieren der Rechte';
      messageType = 'error';
    } finally {
      loading = false;
    }
  }

  function getRightsText(rightsObj: any): string {
    const rightsList = [];
    if (rightsObj.download) rightsList.push('Download');
    if (rightsObj.edit) rightsList.push('Bearbeiten');
    if (rightsObj.delete) rightsList.push('Löschen');
    
    return rightsList.length > 0 ? rightsList.join(', ') : 'Keine Rechte';
  }

  function clearMessage() {
    message = '';
  }
</script>

<div class="item-rights-manager">
  <h3>Rechte für "{itemTitle}" verwalten</h3>
  
  {#if message}
    <div class="message {messageType}" on:click={clearMessage}>
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
  .item-rights-manager {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .item-rights-manager h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
    font-size: 1.3rem;
  }

  .message {
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    cursor: pointer;
  }

  .message.success {
    background: var(--success-bg);
    color: var(--success-color);
    border: 1px solid var(--success-border);
  }

  .message.error {
    background: var(--error-bg);
    color: var(--error-color);
    border: 1px solid var(--error-border);
  }

  .message.info {
    background: var(--info-bg);
    color: var(--info-color);
    border: 1px solid var(--info-border);
  }

  .add-rights-section {
    background: var(--bg-primary);
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .add-rights-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .search-section {
    margin-bottom: 1rem;
  }

  .search-section label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .search-section input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .search-section input:focus {
    outline: none;
    border-color: var(--accent-color);
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
    background: var(--bg-primary);
    padding: 1.5rem;
    border-radius: 8px;
  }

  .existing-rights-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
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
    background: var(--bg-secondary);
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
    background: var(--error-color);
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

    .delete-btn {
      align-self: flex-end;
    }
  }
</style>
