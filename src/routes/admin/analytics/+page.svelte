<svelte:head>
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
  <meta name="googlebot" content="noindex, nofollow" />
  <meta name="bingbot" content="noindex, nofollow" />
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';

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
  let botViews = 0; // Added for bot views
  let searchEngineViews = 0; // Added for search engine visitors
  let functionAvailable = false; // Track if SQL function is available

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

  async function loadAllViewsInBatches() {
    let allViews: any[] = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;
    
    console.log('Loading all views in batches...');
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('item_views')
        .select('created_at, visitor_id, distance_meters, user_agent, referer')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: false });
      
      if (batchError) {
        console.error('Error loading view batch:', batchError);
        break;
      }
      
      if (batch && batch.length > 0) {
        allViews = allViews.concat(batch);
        offset += batchSize;
        
        // If we got less than batchSize, we've reached the end
        if (batch.length < batchSize) {
          hasMore = false;
        }
        
        console.log(`Loaded batch: ${batch.length} views, total: ${allViews.length}`);
      } else {
        hasMore = false;
      }
    }
    
    console.log(`Total views loaded: ${allViews.length}`);
    return allViews;
  }

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

      // Try to load data using SQL function first
      let allViews: any[] = [];
      const { data: stats, error: statsError } = await supabase
        .rpc('get_all_item_views');
      
      if (statsError) {
        console.log('SQL function not available, using batch loading...');
        functionAvailable = false;
        allViews = await loadAllViewsInBatches();
      } else {
        console.log('SQL function available, using direct query...');
        functionAvailable = true;
        allViews = stats || [];
      }
      
      if (allViews.length === 0) {
        console.log('No views found');
        totalViews = 0;
        todayViews = 0;
        thisWeekViews = 0;
        thisMonthViews = 0;
        totalUniqueUsers = 0;
        totalAuthenticatedUsers = 0;
        totalAnonymousUsers = 0;
        avgDistanceMeters = 0;
        localViews = 0;
        botViews = 0;
        searchEngineViews = 0;
        return;
      }
      
      console.log(`Processing ${allViews.length} total views...`);
      
      // Filter out bots
      const views = allViews.filter(v => {
        const userAgent = (v.user_agent || '').toLowerCase();
        return !userAgent.includes('bot') && 
               !userAgent.includes('crawler') && 
               !userAgent.includes('spider') && 
               !userAgent.includes('googlebot') && 
               !userAgent.includes('bingbot') && 
               !userAgent.includes('yandex') && 
               !userAgent.includes('baiduspider') && 
               !userAgent.includes('facebookexternalhit') && 
               !userAgent.includes('twitterbot') && 
               !userAgent.includes('linkedinbot') && 
               !userAgent.includes('whatsapp') && 
               !userAgent.includes('telegram') && 
               !userAgent.includes('slack') && 
               !userAgent.includes('discord') && 
               !userAgent.includes('curl') && 
               !userAgent.includes('wget') && 
               !userAgent.includes('python') && 
               !userAgent.includes('java') && 
               !userAgent.includes('go-http-client') && 
               !userAgent.includes('okhttp') && 
               !userAgent.includes('apache-httpclient') && 
               !userAgent.includes('postman') && 
               !userAgent.includes('insomnia') && 
               !userAgent.includes('thunder client');
      });
      
      totalViews = views.length;
      
      // Calculate bot views (difference between all views and human views)
      botViews = allViews.length - views.length;
      
      // Calculate search engine views
      searchEngineViews = views.filter(v => {
        const referer = (v.referer || '').toLowerCase();
        return referer.includes('google.com') || 
               referer.includes('google.de') || 
               referer.includes('bing.com') || 
               referer.includes('yahoo.com') || 
               referer.includes('duckduckgo.com') || 
               referer.includes('yandex.com') || 
               referer.includes('baidu.com') || 
               referer.includes('qwant.com') || 
               referer.includes('ecosia.org') || 
               referer.includes('startpage.com') || 
               referer.includes('searx.me') || 
               referer.includes('brave.com') || 
               referer.includes('search.brave.com');
      }).length;
      
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
      
      console.log(`Analytics: ${allViews.length} total views, ${views.length} human views (${allViews.length - views.length} bots filtered)`);
      console.log(`Function available: ${functionAvailable}`);
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
      avgDistanceMeters = 0;
      localViews = 0;
      botViews = 0;
      searchEngineViews = 0;
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
  <InfoPageLayout title="Admin Analytics">
    <div style="width: 100%;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <h2 style="margin: 0; color: var(--text-primary);">Analytics</h2>
          <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary);">Item-View Statistiken und Popularität</p>
        </div>
        <div>
          <!-- Button entfernt - Analytics funktioniert weiterhin -->
        </div>
      </div>
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

        <div class="admin-stat-card gray">
          <div class="admin-stat-content">
            <div class="admin-stat-icon gray">
              🤖
            </div>
            <div class="admin-stat-info">
              <h3>Bot Views gefiltert</h3>
              <p>{formatNumber(botViews)}</p>
            </div>
          </div>
        </div>

        <div class="admin-stat-card yellow">
          <div class="admin-stat-content">
            <div class="admin-stat-icon yellow">
              🔍
            </div>
            <div class="admin-stat-info">
              <h3>Suchmaschinen Views</h3>
              <p>{formatNumber(searchEngineViews)}</p>
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
    </div>
  </InfoPageLayout>
{/if} 

<style>
  /* Admin Analytics Styles */
  .admin-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .admin-stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    transition: all 0.2s;
  }
  
  .admin-stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .admin-stat-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .admin-stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: var(--bg-tertiary);
  }
  
  .admin-stat-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .admin-stat-info p {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .admin-table-container {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .admin-table-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .admin-table-title {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .admin-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .admin-table th,
  .admin-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  .admin-table th {
    background: var(--bg-tertiary);
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  
  .admin-table td {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .admin-item-link {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
  }
  
  .admin-item-link:hover {
    text-decoration: underline;
  }
  
  .admin-action-btn {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .admin-action-btn-primary {
    background: var(--primary-color);
    color: white;
  }
  
  .admin-action-btn-primary:hover {
    background: var(--primary-hover);
  }
  
  .admin-empty {
    text-align: center;
    padding: 3rem 1rem;
  }
  
  .admin-empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .admin-empty-title {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .admin-empty-description {
    margin: 0;
    color: var(--text-secondary);
  }
  
  /* Loading styles */
  .admin-loading {
    text-align: center;
    padding: 3rem 1rem;
  }
  
  .admin-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style> 