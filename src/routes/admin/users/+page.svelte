<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';

  // Base URL for API calls
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

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
  let showEditModal = false;
  let editingUser: any = null;
  let authUsers: any[] = [];

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
        .select('id, full_name, accountname, email, created_at, avatar_url, privacy_mode, save_originals, use_justified_layout, show_welcome', { count: 'exact' });

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
      
      // Load auth users for email information
      await loadAuthUsers();
      
      console.log(`Loaded ${users.length} users, total pages: ${totalPages}`);
    } catch (error) {
      console.error('Error loading users:', error);
      users = [];
      filteredUsers = [];
      totalPages = 0;
    }
  }

  async function loadAuthUsers() {
    try {
      console.log('Loading auth users from:', `${baseUrl}/api/admin/auth-users`);
      // This requires admin API - we'll use a server endpoint
      const response = await fetch(`${baseUrl}/api/admin/auth-users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        authUsers = await response.json();
        console.log(`Loaded ${authUsers.length} auth users`);
      } else {
        const errorText = await response.text();
        console.error('Failed to load auth users:', response.status, errorText);
        authUsers = [];
      }
    } catch (error) {
      console.error('Error loading auth users:', error);
      authUsers = [];
    }
  }

  async function deleteUser(userId) {
    if (!confirm('Möchten Sie diesen Benutzer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/admin/delete-user-permanently`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete failed:', response.status, errorText);
        const error = await response.json().catch(() => ({ error: errorText }));
        throw new Error(error.error || 'Delete failed');
      }

      const result = await response.json();
      console.log('User permanently deleted:', result);
      
      // Reload users to get updated data
      await loadUsers();
      
      alert('Benutzer wurde permanent gelöscht!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Fehler beim Löschen: ${error.message}`);
    }
  }

  async function deleteUserProfile(userId) {
    if (!confirm('Möchten Sie nur das Profil dieses Benutzers löschen? Der Benutzer bleibt in der Auth-Tabelle.')) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/admin/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete failed:', response.status, errorText);
        const error = await response.json().catch(() => ({ error: errorText }));
        throw new Error(error.error || 'Delete failed');
      }

      const result = await response.json();
      console.log('User profile deleted:', result);
      
      // Reload users to get updated data
      await loadUsers();
      
      alert('Benutzerprofil wurde gelöscht!');
    } catch (error) {
      console.error('Error deleting user profile:', error);
      alert(`Fehler beim Löschen: ${error.message}`);
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

  function editUser(user) {
    // Find auth user data for this profile
    const authUser = authUsers.find(auth => auth.id === user.id);
    editingUser = {
      ...user,
      auth_email: authUser?.email || 'Keine E-Mail gefunden',
      email_confirmed: authUser?.email_confirmed_at ? true : false
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    editingUser = null;
  }

  async function checkEmailExists(email) {
    try {
      console.log('Checking email from:', `${baseUrl}/api/admin/auth-users`);
      const response = await fetch(`${baseUrl}/api/admin/auth-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to check email:', response.status, errorText);
        throw new Error('Failed to check email');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking email:', error);
      return { exists: false, user: null };
    }
  }

  async function updateUser(updates) {
    try {
      // If email is being changed, check if it exists
      if (updates.email && updates.email !== editingUser.auth_email) {
        console.log(`🔍 Checking if email ${updates.email} exists...`);
        const emailCheck = await checkEmailExists(updates.email);
        
        if (emailCheck.exists) {
          alert(`E-Mail-Adresse ${updates.email} wird bereits von Benutzer ${emailCheck.user.id} verwendet.`);
          return;
        }
        console.log('✅ Email is available');
      }

      const response = await fetch(`${baseUrl}/api/admin/update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingUser.id,
          updates
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update failed:', response.status, errorText);
        const error = await response.json().catch(() => ({ error: errorText }));
        throw new Error(error.error || 'Update failed');
      }

      const result = await response.json();
      console.log('User updated successfully:', result);
      
      // Reload users to get updated data
      await loadUsers();
      closeEditModal();
      
      alert('Benutzer erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Error updating user:', error);
      alert(`Fehler beim Aktualisieren: ${error.message}`);
    }
  }

  async function refreshCache(table = null, userId = null) {
    try {
      console.log(`🔄 Refreshing cache for table: ${table || 'all'}, userId: ${userId || 'all'}`);
      
      const response = await fetch(`${baseUrl}/api/admin/refresh-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ table, userId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cache refresh failed:', response.status, errorText);
        const error = await response.json().catch(() => ({ error: errorText }));
        throw new Error(error.error || 'Cache refresh failed');
      }

      const result = await response.json();
      console.log('Cache refresh completed:', result);
      
      // Reload users to get fresh data
      await loadUsers();
      
      alert('Cache erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Error refreshing cache:', error);
      alert(`Fehler beim Cache-Refresh: ${error.message}`);
    }
  }

  async function forceUpdateUser(userId, updates) {
    try {
      console.log(`🔄 Force updating user: ${userId}`, updates);
      
      const response = await fetch(`${baseUrl}/api/admin/force-update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          updates
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Force update failed:', response.status, errorText);
        const error = await response.json().catch(() => ({ error: errorText }));
        throw new Error(error.error || 'Force update failed');
      }

      const result = await response.json();
      console.log('User force updated successfully:', result);
      
      // Reload users to get updated data
      await loadUsers();
      
      alert('Benutzer erfolgreich force-updated!');
    } catch (error) {
      console.error('Error force updating user:', error);
      alert(`Fehler beim Force-Update: ${error.message}`);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('✅ Copied to clipboard:', text);
      // Optional: Show a brief success message
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
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
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <button
              on:click={() => loadUsers()}
              class="admin-btn admin-btn-primary"
              style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
            >
              🔄 Aktualisieren
            </button>
            <button
              on:click={() => refreshCache()}
              class="admin-btn admin-btn-secondary"
              style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
              title="Cache für alle Tabellen aktualisieren"
            >
              🗄️ Cache
            </button>
            <button
              on:click={() => refreshCache('profiles')}
              class="admin-btn admin-btn-secondary"
              style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
              title="Nur Profile-Cache aktualisieren"
            >
              👥 Profile
            </button>
            <button
              on:click={() => refreshCache('items')}
              class="admin-btn admin-btn-secondary"
              style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
              title="Nur Items-Cache aktualisieren"
            >
              🖼️ Items
            </button>
          </div>
        </div>
        
        {#if users.length > 0}
          <table class="admin-table">
            <thead>
              <tr>
                <th>Benutzer</th>
                <th>E-Mail</th>
                <th>Account Name</th>
                <th>Erstellt</th>
                <th>Privacy</th>
                <th>Save Originals</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user}
                {@const authUser = authUsers.find(auth => auth.id === user.id)}
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
                        {#if user.avatar_url}
                          <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 0.25rem;">
                            Avatar: {user.avatar_url.slice(0, 80)}...
                          </div>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 0.875rem;">
                      <div style="color: var(--admin-text-primary);">
                        {authUser?.email || 'Keine E-Mail'}
                      </div>
                      {#if authUser}
                        <div style="font-size: 0.75rem; color: var(--admin-text-light);">
                          {authUser.email_confirmed_at ? '✅ Bestätigt' : '❌ Nicht bestätigt'}
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td>
                    {#if user.accountname}
                      <a 
                        href="/{user.accountname}" 
                        style="color: #f59e0b; text-decoration: none; font-weight: 500;"
                        on:mouseenter={(e) => e.target.style.textDecoration = 'underline'}
                        on:mouseleave={(e) => e.target.style.textDecoration = 'none'}
                      >
                        {user.accountname}
                      </a>
                    {:else}
                      N/A
                    {/if}
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
                    <div style="display: flex; gap: 0.25rem; flex-direction: column;">
                      <button
                        on:click={() => editUser(user)}
                        class="admin-btn admin-btn-secondary"
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                      >
                        Bearbeiten
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
      </div>
    </div>
  </div>
{/if}

<!-- Edit User Modal -->
{#if showEditModal && editingUser}
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;" on:click={closeEditModal}>
    <div style="max-width: 600px; width: 90%; background: #1f2937; border: 2px solid #374151; border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); overflow: hidden;" on:click|stopPropagation>
      
      <!-- Header -->
      <div style="padding: 20px 20px 15px 20px; border-bottom: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; background: #111827;">
        <h3 style="margin: 0; font-size: 18px; color: #f9fafb; font-weight: 600;">Benutzer bearbeiten</h3>
        <button 
          on:click={closeEditModal} 
          style="background: none; border: none; font-size: 20px; color: #9ca3af; cursor: pointer; padding: 5px; border-radius: 4px; transition: background-color 0.2s;"
          on:mouseenter={(e) => e.target.style.backgroundColor = '#374151'}
          on:mouseleave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ✕
        </button>
      </div>
      
      <!-- Content -->
      <div style="padding: 20px;">
        <!-- User Info -->
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding: 15px; background: #374151; border-radius: 8px;">
          <div class="admin-avatar" style="width: 60px; height: 60px;">
            {#if editingUser.avatar_url}
              {#if editingUser.avatar_url.startsWith('https://caskhmcbvtevdwsolvwk.supabase.co')}
                <img 
                  src={editingUser.avatar_url}
                  alt={editingUser.full_name || editingUser.accountname || 'User'}
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                />
              {:else if editingUser.avatar_url.startsWith('http')}
                <img 
                  src={getOptimizedAvatarUrl(editingUser.avatar_url)}
                  alt={editingUser.full_name || editingUser.accountname || 'User'}
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                />
              {:else}
                <img 
                  src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${editingUser.avatar_url}`}
                  alt={editingUser.full_name || editingUser.accountname || 'User'}
                  style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                />
              {/if}
            {:else}
              {getInitials(editingUser.full_name || editingUser.accountname || 'U')}
            {/if}
          </div>
          <div style="flex: 1;">
            <h4 style="margin: 0 0 5px 0; font-size: 16px; color: #f9fafb; font-weight: 500;">
              {editingUser.full_name || editingUser.accountname || 'Unbekannt'}
            </h4>
            <p style="margin: 0; color: #d1d5db; font-size: 14px;">
              ID: <strong>{editingUser.id}</strong>
            </p>
          </div>
        </div>
        
        <!-- Form Fields -->
        <div style="display: grid; gap: 20px;">
          <!-- Basic Info -->
          <div>
            <label for="full_name" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
              Vollständiger Name:
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              value={editingUser.full_name || ''}
              placeholder="Vollständiger Name"
              style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-size: 14px; font-weight: 500; box-sizing: border-box;"
            />
          </div>
          
          <div>
            <label for="accountname" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
              Account Name:
            </label>
            <input
              id="accountname"
              name="accountname"
              type="text"
              value={editingUser.accountname || ''}
              placeholder="Account Name"
              style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-size: 14px; font-weight: 500; box-sizing: border-box;"
            />
          </div>
          
          <div>
            <label for="email" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
              E-Mail-Adresse:
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={editingUser.auth_email || ''}
              placeholder="E-Mail-Adresse"
              style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-size: 14px; font-weight: 500; box-sizing: border-box;"
            />
            <div style="margin-top: 8px; font-size: 14px; font-weight: 500; color: #d1d5db;">
              {editingUser.email_confirmed ? '✅ E-Mail bestätigt' : '❌ E-Mail nicht bestätigt'}
            </div>
          </div>
          
          <div>
            <label for="privacy_mode" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
              Privacy Mode:
            </label>
            <select 
              id="privacy_mode" 
              name="privacy_mode" 
              style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-size: 14px; font-weight: 500; box-sizing: border-box;"
            >
              <option value="public" selected={editingUser.privacy_mode === 'public'}>Public - Alle können sehen</option>
              <option value="closed" selected={editingUser.privacy_mode === 'closed'}>Closed - Nur angemeldete Benutzer</option>
              <option value="private" selected={editingUser.privacy_mode === 'private'}>Private - Nur der Benutzer selbst</option>
            </select>
          </div>
          
          <div>
            <label for="save_originals" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
              Save Originals:
            </label>
            <select 
              id="save_originals" 
              name="save_originals" 
              style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-size: 14px; font-weight: 500; box-sizing: border-box;"
            >
              <option value="true" selected={editingUser.save_originals === true}>Ja</option>
              <option value="false" selected={editingUser.save_originals === false}>Nein</option>
            </select>
          </div>
          
          <div>
            <label for="use_justified_layout" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
              Justified Layout:
            </label>
            <select 
              id="use_justified_layout" 
              name="use_justified_layout" 
              style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-size: 14px; font-weight: 500; box-sizing: border-box;"
            >
              <option value="true" selected={editingUser.use_justified_layout === true}>Ja</option>
              <option value="false" selected={editingUser.use_justified_layout === false}>Nein</option>
            </select>
          </div>
          
          <div>
            <label for="show_welcome" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
              Show Welcome:
            </label>
            <select 
              id="show_welcome" 
              name="show_welcome" 
              style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-size: 14px; font-weight: 500; box-sizing: border-box;"
            >
              <option value="true" selected={editingUser.show_welcome === true}>Ja</option>
              <option value="false" selected={editingUser.show_welcome === false}>Nein</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Buttons -->
      <div style="padding: 15px 20px 20px 20px; border-top: 1px solid #374151; display: flex; justify-content: flex-end; gap: 12px; background: #111827;">
        <button 
          on:click={closeEditModal} 
          style="padding: 10px 20px; font-size: 14px; font-weight: 500; background: #4b5563; border: 1px solid #6b7280; color: #f9fafb; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
          on:mouseenter={(e) => e.target.style.backgroundColor = '#6b7280'}
          on:mouseleave={(e) => e.target.style.backgroundColor = '#4b5563'}
        >
          Abbrechen
        </button>
        <button
          on:click={() => {
            const formData = new FormData(document.querySelector('form'));
            const updates = {
              full_name: formData.get('full_name'),
              accountname: formData.get('accountname'),
              email: formData.get('email'),
              privacy_mode: formData.get('privacy_mode'),
              save_originals: formData.get('save_originals') === 'true',
              use_justified_layout: formData.get('use_justified_layout') === 'true',
              show_welcome: formData.get('show_welcome') === 'true'
            };
            updateUser(updates);
          }}
          style="padding: 10px 20px; font-size: 14px; font-weight: 500; background: #f59e0b; border: 1px solid #d97706; color: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; opacity: 1;"
          on:mouseenter={(e) => e.target.style.opacity = '0.8'}
          on:mouseleave={(e) => e.target.style.opacity = '1'}
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
{/if} 