<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';

  let isLoading = true;
  let isAdmin = false;
  let users: any[] = [];
  let filteredUsers: any[] = [];
  let searchTerm = '';
  let currentPage = 0;
  let totalPages = 0;
  let itemsPerPage = 20;
  let selectedUser: any = null;
  let showModal = false;

  onMount(async () => {
    // Wait for authentication to be ready
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No session found, redirecting to login');
      goto('/login');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    // Check for admin access (johann.dirschl@gmx.de or specific user ID)
    if (user?.email === 'johann.dirschl@gmx.de' || user?.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09') {
      console.log('Admin access granted');
      isAdmin = true;
      await loadUsers();
    } else {
      console.log('Access denied for:', user?.email, 'ID:', user?.id);
      // Don't redirect immediately, show access denied message
      isAdmin = false;
    }
    isLoading = false;
  });

  async function loadUsers() {
    try {
      console.log('Loading users...');
      
      let query = supabase
        .from('profiles')
        .select('id, full_name, accountname, email, created_at, avatar_url', { count: 'exact' });

      // Apply search filter
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,accountname.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Apply pagination
      const from = currentPage * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error loading users:', error);
        users = [];
        filteredUsers = [];
        totalPages = 0;
        return;
      }

      users = data || [];
      filteredUsers = users;
      totalPages = Math.ceil((count || 0) / itemsPerPage);
      
      console.log(`Loaded ${users.length} users, total pages: ${totalPages}`);
    } catch (error) {
      console.error('Error loading users:', error);
      users = [];
      filteredUsers = [];
      totalPages = 0;
    }
  }

  async function deleteUser(userId) {
    if (!confirm('Sind Sie sicher, dass Sie diesen Benutzer löschen möchten? Alle Items des Benutzers werden ebenfalls gelöscht.')) {
      return;
    }

    try {
      // Delete user's items first
      const { error: itemsError } = await supabase
        .from('items')
        .delete()
        .eq('profile_id', userId);

      if (itemsError) {
        console.error('Error deleting user items:', itemsError);
      }

      // Delete user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        alert('Fehler beim Löschen des Benutzers');
        return;
      }

      // Note: Auth user deletion requires admin API
      alert('Benutzer erfolgreich gelöscht (Profil und Items). Auth-User muss manuell über Supabase Admin gelöscht werden.');
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Fehler beim Löschen des Benutzers');
    }
  }

  function showUserDetails(user) {
    selectedUser = user;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedUser = null;
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

  function getOptimizedAvatarUrl(avatarUrl) {
    console.log('🔍 Optimizing avatar URL:', avatarUrl);
    
    // Handle Google OAuth avatars - optimize size and remove problematic parameters
    if (avatarUrl.includes('lh3.googleusercontent.com')) {
      // Remove size parameters and add optimal size
      const baseUrl = avatarUrl.split('=')[0];
      const optimizedUrl = `${baseUrl}=s128-c`;
      console.log('🔧 Google OAuth avatar optimized:', optimizedUrl);
      return optimizedUrl;
    }
    // Handle Facebook OAuth avatars
    if (avatarUrl.includes('graph.facebook.com') || avatarUrl.includes('platform-lookaside.fbsbx.com')) {
      // Add size parameter for Facebook avatars
      const separator = avatarUrl.includes('?') ? '&' : '?';
      const optimizedUrl = `${avatarUrl}${separator}width=128&height=128`;
      console.log('🔧 Facebook OAuth avatar optimized:', optimizedUrl);
      return optimizedUrl;
    }
    console.log('🔧 Using original avatar URL:', avatarUrl);
    return avatarUrl;
  }

  function getInitials(name) {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Reactive statements
  $: if (searchTerm !== undefined) {
    currentPage = 0;
    loadUsers();
  }

  $: if (currentPage !== undefined) {
    loadUsers();
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
          <h1 class="admin-title">Benutzer verwalten</h1>
          <p class="admin-subtitle">Alle Benutzer anzeigen und verwalten</p>
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
          <a href="/admin/users" class="admin-nav-link active">Benutzer</a>
          <a href="/admin/items" class="admin-nav-link">Items</a>
          <a href="/admin/analytics" class="admin-nav-link">Analytics</a>
          <a href="/admin/create-user" class="admin-nav-link">Benutzer erstellen</a>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="admin-main">
      <!-- Search -->
      <div class="admin-search-container">
        <div class="admin-search-header">
          <h3 class="admin-search-title">🔍 Benutzer suchen</h3>
        </div>
        <div class="admin-search-grid">
          <div class="admin-form-group">
            <label for="search" class="admin-form-label">Suche</label>
            <input
              id="search"
              type="text"
              bind:value={searchTerm}
              placeholder="Name oder Account-Name suchen..."
              class="admin-form-input"
            />
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="admin-table-container">
        <div class="admin-table-header">
          <h3 class="admin-table-title">👥 Benutzer ({users.length})</h3>
        </div>
        
        {#if users.length > 0}
          <table class="admin-table">
            <thead>
              <tr>
                <th>Benutzer</th>
                <th>Account Name</th>
                <th>ID</th>
                <th>Erstellt</th>
                <th>Privacy</th>
                <th>Save Originals</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user}
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div class="admin-avatar">
                        {#if user.avatar_url}
                          {#if user.avatar_url.startsWith('https://caskhmcbvtevdwsolvwk.supabase.co')}
                            <img 
                              src={user.avatar_url}
                              alt={user.full_name || user.accountname || 'User'}
                              style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                            />
                          {:else if user.avatar_url.startsWith('http')}
                            <img 
                              src={getOptimizedAvatarUrl(user.avatar_url)}
                              alt={user.full_name || user.accountname || 'User'}
                              style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                              on:error={(e) => {
                                console.error('❌ External avatar failed to load:', user.avatar_url);
                                console.error('❌ Error details:', e);
                                // Hide the broken image and show initials instead
                                e.target.style.display = 'none';
                                if (e.target.nextElementSibling) {
                                  e.target.nextElementSibling.style.display = 'flex';
                                }
                              }}
                            />
                            <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background: var(--admin-primary); color: white; border-radius: 50%; font-weight: bold;">
                              {getInitials(user.full_name || user.accountname || 'U')}
                            </div>
                          {:else}
                            <img 
                              src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${user.avatar_url}`}
                              alt={user.full_name || user.accountname || 'User'}
                              style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                            />
                          {/if}
                        {:else}
                          {getInitials(user.full_name || user.accountname || 'U')}
                        {/if}
                      </div>
                      <div>
                        <div style="font-weight: 600; color: var(--admin-text-primary);">
                          {user.full_name || user.accountname || 'Unbekannt'}
                        </div>
                        <div style="font-size: 0.875rem; color: var(--admin-text-secondary);">
                          {user.email} • ID: {user.id.slice(0, 8)}...
                        </div>
                        {#if user.avatar_url}
                          <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 0.25rem;">
                            Avatar: {user.avatar_url.slice(0, 80)}...
                          </div>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td>{user.accountname || 'N/A'}</td>
                  <td style="font-family: monospace; font-size: 0.875rem;">
                    {user.id.slice(0, 8)}...
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <span class="admin-btn admin-btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                      {user.privacy_mode || 'public'}
                    </span>
                  </td>
                  <td>
                    <span class="admin-btn admin-btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                      {user.save_originals ? 'Ja' : 'Nein'}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.5rem;">
                      <button
                        on:click={() => showUserDetails(user)}
                        class="admin-btn admin-btn-secondary"
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                      >
                        Details
                      </button>
                      <button
                        on:click={() => deleteUser(user.id)}
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
            <div class="admin-empty-icon">👥</div>
            <h2 class="admin-empty-title">Keine Benutzer gefunden</h2>
            <p class="admin-empty-description">
              {searchTerm ? 'Keine Benutzer entsprechen Ihrer Suche.' : 'Es sind noch keine Benutzer vorhanden.'}
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

<!-- User Details Modal -->
{#if showModal && selectedUser}
  <div class="admin-modal-overlay" on:click={closeModal}>
    <div class="admin-modal" on:click|stopPropagation>
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">Benutzer Details</h3>
        <button class="admin-modal-close" on:click={closeModal}>✕</button>
      </div>
      <div class="admin-modal-content">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
          <div class="admin-avatar" style="width: 3rem; height: 3rem;">
            {getInitials(selectedUser.full_name || selectedUser.accountname || 'U')}
          </div>
          <div>
            <h4 style="margin: 0; font-size: 1.125rem; color: var(--admin-text);">
              {selectedUser.full_name || 'Unbekannt'}
            </h4>
            <p style="margin: 0.25rem 0 0 0; color: var(--admin-text-light);">
              {selectedUser.email || 'Keine E-Mail'}
            </p>
          </div>
        </div>
        
        <div style="display: grid; gap: 1rem;">
          <div>
            <strong>Account Name:</strong> {selectedUser.accountname || 'N/A'}
          </div>
          <div>
            <strong>User ID:</strong> 
            <span style="font-family: monospace; font-size: 0.875rem;">
              {selectedUser.id}
            </span>
          </div>
          <div>
            <strong>Erstellt:</strong> {formatDate(selectedUser.created_at)}
          </div>
          <div>
            <strong>Privacy Mode:</strong> {selectedUser.privacy_mode || 'public'}
          </div>
          <div>
            <strong>Save Originals:</strong> {selectedUser.save_originals ? 'Ja' : 'Nein'}
          </div>
          <div>
            <strong>Use Justified Layout:</strong> {selectedUser.use_justified_layout ? 'Ja' : 'Nein'}
          </div>
          <div>
            <strong>Show Welcome:</strong> {selectedUser.show_welcome ? 'Ja' : 'Nein'}
          </div>
        </div>
      </div>
      <div class="admin-modal-actions">
        <button class="admin-btn admin-btn-secondary" on:click={closeModal}>Schließen</button>
        <button
          class="admin-btn admin-btn-danger"
          on:click={() => { deleteUser(selectedUser.id); closeModal(); }}
        >
          Benutzer löschen
        </button>
      </div>
    </div>
  </div>
{/if} 