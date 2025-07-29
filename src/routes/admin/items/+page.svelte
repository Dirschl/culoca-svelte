<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';

  let isLoading = true;
  let isAdmin = false;
  let items: any[] = [];
  let filteredItems: any[] = [];
  let searchTerm = '';
  let userFilter = '';
  let privacyFilter = 'all';
  let currentPage = 0;
  let totalPages = 0;
  let itemsPerPage = 20;
  let selectedItem: any = null;
  let showModal = false;
  let users = [];

  onMount(async () => {
    // Wait for authentication to be ready
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No session found, redirecting to login');
      goto('/login');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user email:', user?.email);
    console.log('Current user ID:', user?.id);
    
    // Check for admin access (johann.dirschl@gmx.de or specific user ID)
    if (user?.email === 'johann.dirschl@gmx.de' || user?.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09') {
      console.log('Admin access granted');
      isAdmin = true;
      await loadUsers();
      await loadItems();
    } else {
      console.log('Access denied for:', user?.email, 'ID:', user?.id);
      // Don't redirect immediately, show access denied message
      isAdmin = false;
    }
    isLoading = false;
  });

  async function loadUsers() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, accountname')
        .order('full_name');
      users = data || [];
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async function loadItems() {
    try {
      console.log('Loading items...');
      
      let query = supabase
        .from('items')
        .select(`
          id, title, description, original_name, created_at, profile_id, 
          is_private, path_64, path_512, width, height,
          profiles!inner(id, full_name, accountname, email)
        `, { count: 'exact' });

      // Apply search filter
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,original_name.ilike.%${searchTerm}%`);
      }

      // Apply user filter
      if (userFilter) {
        query = query.eq('profile_id', userFilter);
      }

      // Apply privacy filter
      if (privacyFilter === 'private') {
        query = query.eq('is_private', true);
      } else if (privacyFilter === 'public') {
        query = query.eq('is_private', false);
      }

      // Apply pagination
      const from = currentPage * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error loading items:', error);
        items = [];
        filteredItems = [];
        totalPages = 0;
        return;
      }

      items = data || [];
      filteredItems = items;
      totalPages = Math.ceil((count || 0) / itemsPerPage);
      
      console.log(`Loaded ${items.length} items, total pages: ${totalPages}`);
    } catch (error) {
      console.error('Error loading items:', error);
      items = [];
      filteredItems = [];
      totalPages = 0;
    }
  }

  async function deleteItem(itemId) {
    if (!confirm('Sind Sie sicher, dass Sie dieses Item löschen möchten?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Error deleting item:', error);
        alert('Fehler beim Löschen des Items');
        return;
      }

      alert('Item erfolgreich gelöscht');
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Fehler beim Löschen des Items');
    }
  }

  async function togglePrivacy(itemId, currentPrivacy) {
    try {
      const { error } = await supabase
        .from('items')
        .update({ is_private: !currentPrivacy })
        .eq('id', itemId);

      if (error) {
        console.error('Error updating item privacy:', error);
        alert('Fehler beim Ändern der Privacy-Einstellung');
        return;
      }

      await loadItems();
    } catch (error) {
      console.error('Error updating item privacy:', error);
      alert('Fehler beim Ändern der Privacy-Einstellung');
    }
  }

  function showItemDetails(item) {
    selectedItem = item;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedItem = null;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getUserName(item) {
    return item.profiles?.full_name || item.profiles?.accountname || 'Unbekannt';
  }

  // Reactive statements
  $: if (searchTerm !== undefined || userFilter !== undefined || privacyFilter !== undefined) {
    currentPage = 0;
    loadItems();
  }

  $: if (currentPage !== undefined) {
    loadItems();
  }
</script>

{#if isLoading}
  <div class="admin-container">
    <div class="admin-loading">
      <div class="admin-spinner"></div>
    </div>
  </div>
{:else if !isAdmin}
  <div class="admin-container">
    <div class="admin-main">
      <div class="admin-empty">
        <div class="admin-empty-icon">🚫</div>
        <h2 class="admin-empty-title">Zugriff verweigert</h2>
        <p class="admin-empty-description">Sie haben keine Berechtigung, auf das Admin-Dashboard zuzugreifen.</p>
        <a href="/" class="admin-btn admin-btn-primary">Zurück zur Galerie</a>
      </div>
    </div>
  </div>
{:else}
  <div class="admin-container">
    <!-- Header -->
    <header class="admin-header">
      <div class="admin-header-content">
        <div>
          <h1 class="admin-title">Items verwalten</h1>
          <p class="admin-subtitle">Alle Bilder anzeigen und verwalten</p>
        </div>
        <nav class="admin-nav">
          <a href="/admin" class="admin-btn admin-btn-secondary">← Zurück zum Dashboard</a>
        </nav>
      </div>
    </header>

    <!-- Navigation -->
    <nav class="admin-navbar">
      <div class="admin-navbar-content">
        <div class="admin-navbar-links">
          <a href="/admin" class="admin-nav-link">Dashboard</a>
          <a href="/admin/users" class="admin-nav-link">Benutzer</a>
          <a href="/admin/items" class="admin-nav-link active">Items</a>
          <a href="/admin/analytics" class="admin-nav-link">Analytics</a>
          <a href="/admin/create-user" class="admin-nav-link">Benutzer erstellen</a>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="admin-main">
      <!-- Search and Filters -->
      <div class="admin-search-container">
        <div class="admin-search-header">
          <h3 class="admin-search-title">🔍 Items suchen und filtern</h3>
        </div>
        <div class="admin-search-grid">
          <div class="admin-form-group">
            <label for="search" class="admin-form-label">Suche</label>
            <input
              id="search"
              type="text"
              bind:value={searchTerm}
              placeholder="Titel, Beschreibung oder Dateiname..."
              class="admin-form-input"
            />
          </div>

          <div class="admin-form-group">
            <label for="user-filter" class="admin-form-label">Benutzer</label>
            <select
              id="user-filter"
              bind:value={userFilter}
              class="admin-form-select"
            >
              <option value="">Alle Benutzer</option>
              {#each users as user}
                <option value={user.id}>{user.full_name || user.accountname || 'Unbekannt'}</option>
              {/each}
            </select>
          </div>

          <div class="admin-form-group">
            <label for="privacy-filter" class="admin-form-label">Privacy</label>
            <select
              id="privacy-filter"
              bind:value={privacyFilter}
              class="admin-form-select"
            >
              <option value="all">Alle</option>
              <option value="public">Öffentlich</option>
              <option value="private">Privat</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <div class="admin-table-container">
        <div class="admin-table-header">
          <h3 class="admin-table-title">🖼️ Items ({items.length})</h3>
        </div>
        
        {#if items.length > 0}
          <table class="admin-table">
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Titel</th>
                <th>Benutzer</th>
                <th>Größe</th>
                <th>Erstellt</th>
                <th>GPS</th>
                <th>Privacy</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each items as item}
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <img 
                        src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`}
                        alt="Item preview"
                        style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;"
                        on:error={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) {
                            e.target.nextElementSibling.style.display = 'flex';
                          }
                        }}
                      />
                      <div style="display: none; width: 40px; height: 40px; background: var(--bg-tertiary); border-radius: 6px; align-items: center; justify-content: center; font-size: 1.25rem;">
                        🖼️
                      </div>
                      <div>
                        <a href={`/item/${item.slug}`} class="admin-item-link" target="_blank">
                          {item.title || item.original_name || 'Unbenannt'}
                        </a>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">
                          ID: {item.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div style="font-weight: 600; color: var(--admin-text);">
                        {item.title || item.original_name || 'Unbenannt'}
                      </div>
                      {#if item.description}
                        <div style="font-size: 0.875rem; color: var(--admin-text-light); margin-top: 0.25rem;">
                          {item.description.slice(0, 50)}...
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 0.875rem; color: var(--admin-text);">
                      {getUserName(item)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--admin-text-light); font-family: monospace;">
                      {item.profile_id?.slice(0, 8)}...
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 0.875rem; color: var(--admin-text);">
                      {item.width} × {item.height}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--admin-text-light);">
                      {formatFileSize(item.file_size)}
                    </div>
                  </td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    {#if item.lat && item.lon}
                      <span class="admin-btn admin-btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                        📍 {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                      </span>
                    {:else}
                      <span class="admin-btn admin-btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; opacity: 0.5;">
                        Kein GPS
                      </span>
                    {/if}
                  </td>
                  <td>
                    <button
                      on:click={() => togglePrivacy(item.id, item.is_private)}
                      class="admin-btn {item.is_private ? 'admin-btn-warning' : 'admin-btn-secondary'}"
                      style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                    >
                      {item.is_private ? '🔒 Privat' : '🌐 Öffentlich'}
                    </button>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.5rem;">
                      <button
                        on:click={() => showItemDetails(item)}
                        class="admin-btn admin-btn-secondary"
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                      >
                        Details
                      </button>
                      <button
                        on:click={() => deleteItem(item.id)}
                        class="admin-btn admin-btn-danger"
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="admin-empty">
            <div class="admin-empty-icon">🖼️</div>
            <h2 class="admin-empty-title">Keine Items gefunden</h2>
            <p class="admin-empty-description">
              {searchTerm || userFilter || privacyFilter !== 'all' ? 'Keine Items entsprechen Ihren Filtern.' : 'Es sind noch keine Items vorhanden.'}
            </p>
          </div>
        {/if}
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="admin-pagination">
          <div class="admin-pagination-content">
            <div class="admin-pagination-info">
              Seite {currentPage + 1} von {totalPages}
            </div>
            <div class="admin-pagination-nav">
              <button
                class="admin-pagination-btn"
                disabled={currentPage === 0}
                on:click={() => currentPage--}
              >
                ← Zurück
              </button>
              <button
                class="admin-pagination-btn"
                disabled={currentPage >= totalPages - 1}
                on:click={() => currentPage++}
              >
                Weiter →
              </button>
            </div>
          </div>
        </div>
      {/if}
    </main>
  </div>
{/if}

<!-- Item Details Modal -->
{#if showModal && selectedItem}
  <div class="admin-modal-overlay" on:click={closeModal}>
    <div class="admin-modal" on:click|stopPropagation>
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">Item Details</h3>
        <button class="admin-modal-close" on:click={closeModal}>✕</button>
      </div>
      <div class="admin-modal-content">
        <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem;">
          {#if selectedItem.path_512}
            <img 
              src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${selectedItem.path_512}`}
              alt={selectedItem.title || 'Item'}
              style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px;"
            />
          {:else}
            <div style="width: 200px; height: 150px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b;">
              📷
            </div>
          {/if}
          <div style="flex: 1;">
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.125rem; color: var(--admin-text);">
              {selectedItem.title || selectedItem.original_name || 'Unbenannt'}
            </h4>
            {#if selectedItem.description}
              <p style="margin: 0; color: var(--admin-text-light); font-size: 0.875rem;">
                {selectedItem.description}
              </p>
            {/if}
          </div>
        </div>
        
        <div style="display: grid; gap: 1rem;">
          <div>
            <strong>Item ID:</strong> 
            <span style="font-family: monospace; font-size: 0.875rem;">
              {selectedItem.id}
            </span>
          </div>
          <div>
            <strong>Benutzer:</strong> {getUserName(selectedItem)}
          </div>
          <div>
            <strong>Größe:</strong> {selectedItem.width} × {selectedItem.height} ({formatFileSize(selectedItem.file_size)})
          </div>
          <div>
            <strong>Erstellt:</strong> {formatDate(selectedItem.created_at)}
          </div>
          {#if selectedItem.lat && selectedItem.lon}
            <div>
              <strong>GPS:</strong> {selectedItem.lat.toFixed(6)}, {selectedItem.lon.toFixed(6)}
            </div>
          {/if}
          <div>
            <strong>Privacy:</strong> {selectedItem.is_private ? 'Privat' : 'Öffentlich'}
          </div>
          <div>
            <strong>Gallery:</strong> {selectedItem.gallery ? 'Ja' : 'Nein'}
          </div>
          {#if selectedItem.keywords && selectedItem.keywords.length > 0}
            <div>
              <strong>Keywords:</strong> {selectedItem.keywords.join(', ')}
            </div>
          {/if}
        </div>
      </div>
      <div class="admin-modal-actions">
        <button class="admin-btn admin-btn-secondary" on:click={closeModal}>Schließen</button>
        <button
          class="admin-btn admin-btn-warning"
          on:click={() => { togglePrivacy(selectedItem.id, selectedItem.is_private); closeModal(); }}
        >
          Privacy ändern
        </button>
        <button
          class="admin-btn admin-btn-danger"
          on:click={() => { deleteItem(selectedItem.id); closeModal(); }}
        >
          Item löschen
        </button>
      </div>
    </div>
  </div>
{/if} 