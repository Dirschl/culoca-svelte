<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';

  let isLoading = true;
  let isAdmin = false;
  let popularItems: any[] = [];
  let totalViews = 0;
  let todayViews = 0;
  let thisWeekViews = 0;
  let thisMonthViews = 0;
  let totalUniqueUsers = 0;
  let totalAuthenticatedUsers = 0;
  let totalAnonymousUsers = 0;
  let avgDistanceMeters = 0;
  let localViews = 0;

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
      await loadAnalytics();
    } else {
      console.log('Access denied for:', user?.email, 'ID:', user?.id);
      isAdmin = false;
    }
    isLoading = false;
  });

  async function loadAnalytics() {
    try {
      console.log('Loading analytics data...');
      
      // Load popular items with detailed stats
      const { data: popular, error: popularError } = await supabase
        .rpc('get_popular_items_detailed', { limit_count: 10 });
      
      if (popularError) {
        console.error('Error loading popular items:', popularError);
        popularItems = [];
      } else {
        popularItems = popular || [];
      }

      // Load overall statistics
      const { data: stats, error: statsError } = await supabase
        .from('item_views')
        .select('created_at, visitor_id, distance_meters');
      
      if (statsError) {
        console.error('Error loading view statistics:', statsError);
        totalViews = 0;
        todayViews = 0;
        thisWeekViews = 0;
        thisMonthViews = 0;
        totalUniqueUsers = 0;
        totalAuthenticatedUsers = 0;
        totalAnonymousUsers = 0;
        avgDistanceMeters = 0;
        localViews = 0;
      } else {
        const views = stats || [];
        totalViews = views.length;
        
        // Calculate unique users (only authenticated users, excluding anonymous)
        const uniqueUserIds = new Set();
        views.forEach(v => {
          if (v.visitor_id) {
            uniqueUserIds.add(v.visitor_id);
          }
        });
        totalUniqueUsers = uniqueUserIds.size;
        
        // Calculate authenticated vs anonymous views
        totalAuthenticatedUsers = views.filter(v => v.visitor_id !== null).length;
        totalAnonymousUsers = views.filter(v => v.visitor_id === null).length;
        
        // Calculate distance statistics
        const viewsWithDistance = views.filter(v => v.distance_meters !== null);
        if (viewsWithDistance.length > 0) {
          const totalDistance = viewsWithDistance.reduce((sum, v) => sum + v.distance_meters, 0);
          avgDistanceMeters = totalDistance / viewsWithDistance.length;
          localViews = viewsWithDistance.filter(v => v.distance_meters <= 10000).length;
        } else {
          avgDistanceMeters = 0;
          localViews = 0;
        }
        
        // Calculate time-based views
        todayViews = views.filter(v => {
          const viewDate = new Date(v.created_at);
          const today = new Date();
          return viewDate.toDateString() === today.toDateString();
        }).length;
        
        thisWeekViews = views.filter(v => {
          const viewDate = new Date(v.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return viewDate >= weekAgo;
        }).length;
        
        thisMonthViews = views.filter(v => {
          const viewDate = new Date(v.created_at);
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          return viewDate >= monthAgo;
        }).length;
      }
      
      console.log('Analytics data loaded successfully');
    } catch (error) {
      console.error('Error loading analytics data:', error);
      popularItems = [];
      totalViews = 0;
      todayViews = 0;
      thisWeekViews = 0;
      thisMonthViews = 0;
      totalUniqueUsers = 0;
      totalAuthenticatedUsers = 0;
      totalAnonymousUsers = 0;
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString('de-DE');
  }

  function formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else if (meters < 100000) {
      return `${(meters / 1000).toFixed(1)}km`;
    } else {
      return `${(meters / 1000).toFixed(0)}km`;
    }
  }

  function getItemUrl(itemId: string): string {
    return `/item/${itemId}`;
  }
</script>

{#if isLoading}
  <div class="admin-container">
    <div class="admin-loading">
      <div class="admin-spinner"></div>
      <p>Lade Analytics...</p>
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
          <h1 class="admin-title">Analytics</h1>
          <p class="admin-subtitle">Item-View Statistiken und Popularität</p>
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
          <a href="/admin/items" class="admin-nav-link">Items</a>
          <a href="/admin/analytics" class="admin-nav-link active">Analytics</a>
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
              👁️
            </div>
            <div class="admin-stat-info">
              <h3>Gesamte Views</h3>
              <p>{formatNumber(totalViews)}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card green">
          <div class="admin-stat-content">
            <div class="admin-stat-icon green">
              👤
            </div>
            <div class="admin-stat-info">
              <h3>Unique Users</h3>
              <p>{formatNumber(totalUniqueUsers)}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card purple">
          <div class="admin-stat-content">
            <div class="admin-stat-icon purple">
              🔐
            </div>
            <div class="admin-stat-info">
              <h3>Authentifizierte Views</h3>
              <p>{formatNumber(totalAuthenticatedUsers)}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card blue">
          <div class="admin-stat-content">
            <div class="admin-stat-icon blue">
              👻
            </div>
            <div class="admin-stat-info">
              <h3>Anonyme Views</h3>
              <p>{formatNumber(totalAnonymousUsers)}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card orange">
          <div class="admin-stat-content">
            <div class="admin-stat-icon orange">
              📅
            </div>
            <div class="admin-stat-info">
              <h3>Views heute</h3>
              <p>{formatNumber(todayViews)}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card red">
          <div class="admin-stat-content">
            <div class="admin-stat-icon red">
              📊
            </div>
            <div class="admin-stat-info">
              <h3>Views diese Woche</h3>
              <p>{formatNumber(thisWeekViews)}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card teal">
          <div class="admin-stat-content">
            <div class="admin-stat-icon teal">
              📏
            </div>
            <div class="admin-stat-info">
              <h3>Ø Entfernung</h3>
              <p>{avgDistanceMeters > 0 ? formatDistance(avgDistanceMeters) : 'N/A'}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card indigo">
          <div class="admin-stat-content">
            <div class="admin-stat-icon indigo">
              🏠
            </div>
            <div class="admin-stat-info">
              <h3>Lokale Views (≤10km)</h3>
              <p>{formatNumber(localViews)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Popular Items -->
      <div class="admin-table-container">
        <div class="admin-table-header">
          <h3 class="admin-table-title">🔥 Beliebte Items</h3>
        </div>
        
        {#if popularItems.length > 0}
          <table class="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Gesamte Views</th>
                <th>Unique Users</th>
                <th>Authentifiziert</th>
                <th>Anonym</th>
                <th>Ø Entfernung</th>
                <th>Lokal (≤10km)</th>
                <th>Views heute</th>
                <th>Views diese Woche</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each popularItems as item}
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div style="width: 40px; height: 40px; background: var(--bg-tertiary); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        🖼️
                      </div>
                      <div>
                        <a href={`/item/${item.item_slug}`} class="admin-item-link" target="_blank">
                          {item.item_title || 'Unbenannt'}
                        </a>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: {item.item_id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td>{formatNumber(item.total_views)}</td>
                  <td>{formatNumber(item.unique_users)}</td>
                  <td>{formatNumber(item.authenticated_users)}</td>
                  <td>{formatNumber(item.anonymous_users)}</td>
                  <td>{item.avg_distance_meters ? formatDistance(item.avg_distance_meters) : 'N/A'}</td>
                  <td>{formatNumber(item.local_views)}</td>
                  <td>{formatNumber(item.views_today)}</td>
                  <td>{formatNumber(item.views_this_week)}</td>
                  <td>
                    <a href={`/item/${item.item_slug}`} class="admin-action-btn admin-action-btn-primary" target="_blank">
                      👁️ Ansehen
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="admin-empty">
            <div class="admin-empty-icon">📊</div>
            <h3 class="admin-empty-title">Keine View-Daten</h3>
            <p class="admin-empty-description">Noch keine Items wurden angesehen.</p>
          </div>
        {/if}
      </div>
    </main>
  </div>
{/if} 