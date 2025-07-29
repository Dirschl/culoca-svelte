<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';

  let isLoading = true;
  let isAdmin = false;
  let totalUsers = 0;
  let totalItems = 0;
  let recentUsers: any[] = [];
  let recentItems: any[] = [];
  let storageUsed = '0 MB';

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
      await loadDashboardData();
    } else {
      console.log('Access denied for:', user?.email, 'ID:', user?.id);
      // Don't redirect immediately, show access denied message
      isAdmin = false;
    }
    isLoading = false;
  });

  async function loadDashboardData() {
    try {
      console.log('Loading dashboard data...');
      
      // Load total users
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      if (usersError) {
        console.error('Error loading users count:', usersError);
        totalUsers = 0;
      } else {
        totalUsers = usersCount || 0;
      }

      // Load total items
      const { count: itemsCount, error: itemsError } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true });
      
      if (itemsError) {
        console.error('Error loading items count:', itemsError);
        totalItems = 0;
      } else {
        totalItems = itemsCount || 0;
      }

      // Load recent users
      const { data: users, error: recentUsersError } = await supabase
        .from('profiles')
        .select('id, full_name, accountname, created_at, avatar_url')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentUsersError) {
        console.error('Error loading recent users:', recentUsersError);
        recentUsers = [];
      } else {
        recentUsers = users || [];
      }

      // Load recent items
      const { data: items, error: recentItemsError } = await supabase
        .from('items')
        .select('id, title, original_name, created_at, profile_id, path_64, slug')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentItemsError) {
        console.error('Error loading recent items:', recentItemsError);
        recentItems = [];
      } else {
        recentItems = items || [];
      }

      // TODO: Calculate storage usage
      storageUsed = '0 MB';
      
      console.log('Dashboard data loaded successfully');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set defaults to prevent UI errors
      totalUsers = 0;
      totalItems = 0;
      recentUsers = [];
      recentItems = [];
      storageUsed = '0 MB';
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
          <h1 class="admin-title">Admin Dashboard</h1>
          <p class="admin-subtitle">Systemverwaltung und Übersicht</p>
        </div>
        <nav class="admin-nav">
          <a href="/" class="admin-btn admin-btn-secondary">← Zurück zur Galerie</a>
        </nav>
      </div>
    </header>

    <!-- Navigation -->
    <nav class="admin-navbar">
      <div class="admin-navbar-content">
        <div class="admin-navbar-links">
          <a href="/admin" class="admin-nav-link active">Dashboard</a>
          <a href="/admin/users" class="admin-nav-link">Benutzer</a>
          <a href="/admin/items" class="admin-nav-link">Items</a>
          <a href="/admin/analytics" class="admin-nav-link">Analytics</a>
          <a href="/admin/create-user" class="admin-nav-link">Benutzer erstellen</a>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="admin-main">
      <!-- Statistics Cards -->
      <div class="admin-stats-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-content">
            <div class="admin-stat-icon">
              👥
            </div>
            <div class="admin-stat-info">
              <h3>Gesamte Benutzer</h3>
              <p>{totalUsers}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card green">
          <div class="admin-stat-content">
            <div class="admin-stat-icon green">
              🖼️
            </div>
            <div class="admin-stat-info">
              <h3>Gesamte Items</h3>
              <p>{totalItems}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card purple">
          <div class="admin-stat-content">
            <div class="admin-stat-icon purple">
              💾
            </div>
            <div class="admin-stat-info">
              <h3>Speicherplatz</h3>
              <p>{storageUsed}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Grid -->
      <div class="admin-activity-grid">
        <!-- Recent Users -->
        <div class="admin-activity-section">
          <h3 class="admin-activity-title">👥 Neueste Benutzer</h3>
          <div class="admin-activity-list">
            {#each recentUsers as user}
              <div class="admin-activity-item">
                <div class="admin-activity-content">
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
                  <div class="admin-activity-info">
                    <div class="admin-activity-name">{user.full_name || user.accountname || 'Unbekannt'}</div>
                    <div class="admin-activity-details">
                      <span>ID: {user.id.slice(0, 8)}...</span>
                      <span>Account: {user.accountname || 'N/A'}</span>
                    </div>
                    <div class="admin-activity-time">
                      {formatDate(user.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
            {#if recentUsers.length === 0}
              <div class="admin-activity-item">
                <div class="admin-activity-content">
                  <div class="admin-activity-info">
                    <div class="admin-activity-name">Keine Benutzer gefunden</div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Recent Items -->
        <div class="admin-activity-section">
          <h3 class="admin-activity-title">🖼️ Neueste Items</h3>
          <div class="admin-activity-list">
            {#each recentItems as item}
              <div class="admin-activity-item">
                <div class="admin-activity-content">
                  <div class="admin-avatar">
                    {#if item.path_64}
                      <img 
                        src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`}
                        alt={item.title || 'Item'}
                        style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                      />
                    {:else}
                      📷
                    {/if}
                  </div>
                  <div class="admin-activity-info">
                    <div class="admin-activity-name">
                      <a href={`/item/${item.slug}`} class="admin-item-link" target="_blank">
                        {item.title || item.original_name || 'Unbenannt'}
                      </a>
                    </div>
                    <div class="admin-activity-details">
                      <span>ID: {item.id.slice(0, 8)}...</span>
                      <span>User: {item.profile_id?.slice(0, 8) || 'N/A'}...</span>
                    </div>
                    <div class="admin-activity-time">
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
            {#if recentItems.length === 0}
              <div class="admin-activity-item">
                <div class="admin-activity-content">
                  <div class="admin-activity-info">
                    <div class="admin-activity-name">Keine Items gefunden</div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="admin-quick-actions">
        <div class="admin-quick-actions-header">
          <h3 class="admin-quick-actions-title">Schnellzugriff</h3>
        </div>
        <div class="admin-quick-actions-grid">
          <a href="/admin/users" class="admin-quick-action">
            <div class="admin-quick-action-icon blue">
              👥
            </div>
            <div class="admin-quick-action-info">
              <h4>Benutzer verwalten</h4>
              <p>Alle Benutzer anzeigen, suchen und verwalten</p>
            </div>
          </a>

          <a href="/admin/items" class="admin-quick-action">
            <div class="admin-quick-action-icon green">
              🖼️
            </div>
            <div class="admin-quick-action-info">
              <h4>Items verwalten</h4>
              <p>Alle Bilder anzeigen, filtern und verwalten</p>
            </div>
          </a>

          <a href="/admin/create-user" class="admin-quick-action">
            <div class="admin-quick-action-icon purple">
              ➕
            </div>
            <div class="admin-quick-action-info">
              <h4>Benutzer erstellen</h4>
              <p>Neue Benutzerkonten manuell anlegen</p>
            </div>
          </a>

          <a href="/" class="admin-quick-action">
            <div class="admin-quick-action-icon blue">
              🏠
            </div>
            <div class="admin-quick-action-info">
              <h4>Zur Galerie</h4>
              <p>Zurück zur Hauptgalerie</p>
            </div>
          </a>
        </div>
      </div>
    </main>
  </div>
{/if} 