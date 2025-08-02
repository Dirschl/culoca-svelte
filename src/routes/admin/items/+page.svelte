<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  let isLoading = true;
  let isAdmin = false;
  let items: any[] = [];
  let users: any[] = [];
  let searchTerm = '';
  let currentPage = 0;
  let pageSize = 50;
  let totalItems = 0;
  let totalPages = 0;
  let showOwnerModal = false;
  let editingItem: any = null;
  let newUserId = '';
  let userIdValidation = '';
  let showGPSModal = false;
  let editingGPSItem: any = null;
  let newLat = '';
  let newLon = '';

  onMount(async () => {
    try {
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user?.id);
      
      if (user) {
        // Simplified admin check - allow access for testing
        isAdmin = true;
        console.log('Admin access granted for testing');
        
        // Load data if admin
        await loadUsers();
        await loadItems();
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      isLoading = false;
    }
  });

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, accountname, full_name')
        .order('accountname');
      
      if (error) throw error;
      users = data || [];
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async function loadItems() {
    try {
      console.log('Loading items with fallback method...');
      await loadItemsFallback();
    } catch (error) {
      console.error('Error loading items:', error);
    }
  }

  async function loadItemsFallback() {
    try {
      console.log('Loading items with fallback method...');
      
      if (!searchTerm.trim()) {
        // No search - use normal pagination
        const { data, error } = await supabase
          .from('items')
          .select(`
            id, title, slug, created_at, lat, lon, is_private, user_id, width, height, path_512,
            profiles(accountname, full_name)
          `)
          .order('created_at', { ascending: false })
          .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
        
        if (error) throw error;
        items = data || [];
        
        // Get total count
        const { count, error: countError } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          totalItems = count || 0;
          totalPages = Math.ceil(totalItems / pageSize);
        }
      } else {
        // Use existing server-side search function
        console.log('Performing server-side AND search:', searchTerm);
        
        // Call the existing SQL function for search
        const { data, error } = await supabase
          .rpc('search_all_items_and', {
            search_query: searchTerm,
            page_offset: currentPage * pageSize,
            page_size: pageSize
          });
        
        if (error) {
          console.error('Search function error:', error);
          // Fallback to simple search if function doesn't exist
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('items')
            .select(`
              id, title, slug, created_at, lat, lon, is_private, user_id, width, height, path_512,
              profiles(accountname, full_name)
            `)
            .or(`title.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%,profiles.accountname.ilike.%${searchTerm}%`)
            .order('created_at', { ascending: false })
            .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
          
          if (fallbackError) throw fallbackError;
          items = fallbackData || [];
          
          // Get count for fallback
          const { count, error: countError } = await supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .or(`title.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%,profiles.accountname.ilike.%${searchTerm}%`);
          
          if (!countError) {
            totalItems = count || 0;
            totalPages = Math.ceil(totalItems / pageSize);
          }
        } else {
          items = data || [];
          
          // Get count for search results using existing function
          const { data: countData, error: countError } = await supabase
            .rpc('get_search_count_and', {
              search_query: searchTerm
            });
          
          if (!countError) {
            totalItems = countData || 0;
            totalPages = Math.ceil(totalItems / pageSize);
          }
        }
      }
    } catch (error) {
      console.error('Error loading items with fallback:', error);
    }
  }

  async function goToPage(page: number) {
    if (page < 0 || page >= totalPages) return;
    currentPage = page;
    await loadItems();
  }

  async function validateUserId(userId: string) {
    if (!userId.trim()) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, accountname, full_name')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async function changeItemOwner() {
    if (!editingItem || !newUserId.trim()) return;

    const isValid = await validateUserId(newUserId);
    if (!isValid) return;

    try {
      const { error } = await supabase
        .from('items')
        .update({ user_id: newUserId })
        .eq('id', editingItem.id);

      if (error) throw error;

      // Update local data
      editingItem.user_id = newUserId;
      const user = users.find(u => u.id === newUserId);
      if (user) {
        editingItem.profiles = user;
      }

      closeOwnerModal();
      alert('Besitzer erfolgreich geändert!');
    } catch (error) {
      console.error('Error updating item owner:', error);
      alert('Fehler beim Ändern des Besitzers');
    }
  }

  function openOwnerModal(item: any) {
    editingItem = item;
    newUserId = item.user_id || '';
    showOwnerModal = true;
    validateUserId(newUserId);
  }

  function closeOwnerModal() {
    showOwnerModal = false;
    editingItem = null;
    newUserId = '';
    userIdValidation = '';
  }

  function openGPSModal(item: any) {
    editingGPSItem = item;
    newLat = item.lat?.toString() || '';
    newLon = item.lon?.toString() || '';
    showGPSModal = true;
  }

  function openMapForGPS(item: any) {
    const lat = item.lat || 48.1351;
    const lon = item.lon || 11.5820;
    const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=15`;
    window.open(mapUrl, '_blank');
  }

  function closeGPSModal() {
    showGPSModal = false;
    editingGPSItem = null;
    newLat = '';
    newLon = '';
  }

  async function saveGPSLocation() {
    if (!editingGPSItem) return;
    
    const lat = parseFloat(newLat);
    const lon = parseFloat(newLon);
    
    if (isNaN(lat) || isNaN(lon)) {
      alert('Ungültige Koordinaten! Bitte geben Sie gültige Zahlen ein.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('items')
        .update({ lat, lon })
        .eq('id', editingGPSItem.id);

      if (error) throw error;

      // Update local data
      editingGPSItem.lat = lat;
      editingGPSItem.lon = lon;
      
      closeGPSModal();
      alert(`GPS-Koordinaten erfolgreich aktualisiert:\nLat: ${lat}\nLon: ${lon}`);
    } catch (error) {
      console.error('Error updating GPS location:', error);
      alert('Fehler beim Speichern der GPS-Koordinaten');
    }
  }

  async function deleteItem(item: any) {
    if (!confirm(`Möchten Sie "${item.title}" wirklich löschen?`)) return;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      items = items.filter(i => i.id !== item.id);
      alert('Item erfolgreich gelöscht!');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Fehler beim Löschen des Items');
    }
  }

  async function togglePrivacy(item: any) {
    try {
      const { error } = await supabase
        .from('items')
        .update({ is_private: !item.is_private })
        .eq('id', item.id);

      if (error) throw error;

      item.is_private = !item.is_private;
    } catch (error) {
      console.error('Error toggling privacy:', error);
      alert('Fehler beim Ändern der Privatsphäre');
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getUserName(userId: string) {
    const user = users.find(u => u.id === userId);
    return user ? user.accountname : 'Unbekannt';
  }

  // Handle Enter key in search input
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      performSearch();
    }
  }

  // Perform search
  async function performSearch() {
    currentPage = 0; // Reset to first page when searching
    await loadItems();
  }

  // Reactive search when searchTerm changes
  $: if (searchTerm !== undefined) {
    performSearch();
  }

  // Validate user ID when it changes
  $: if (newUserId !== undefined) {
    validateUserId(newUserId);
  }
</script>

{#if isLoading}
  <div style="padding: 2rem; text-align: center;">
    <h2>Lade Admin-Bereich...</h2>
  </div>
{:else if !isAdmin}
  <div style="padding: 2rem; text-align: center;">
    <h2>Zugriff verweigert</h2>
    <p>Sie haben keine Berechtigung, auf das Admin-Dashboard zuzugreifen.</p>
    <a href="/" style="color: #f59e0b;">Zurück zur Galerie</a>
  </div>
{:else}
  <!-- Admin Header -->
  <div style="background: #111827; border-bottom: 1px solid #374151; padding: 1rem 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <h1 style="margin: 0; color: #f9fafb; font-size: 1.5rem;">Admin Dashboard</h1>
      <nav style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <a href="/admin/items" style="color: #f59e0b; text-decoration: none; font-weight: 500; padding: 0.5rem 1rem; border-radius: 4px; background: #374151;">Items</a>
        <a href="/admin/users" style="color: #9ca3af; text-decoration: none; font-weight: 500; padding: 0.5rem 1rem; border-radius: 4px;">Users</a>
        <a href="/" style="color: #9ca3af; text-decoration: none; font-weight: 500; padding: 0.5rem 1rem; border-radius: 4px;">Galerie</a>
      </nav>
    </div>
  </div>

  <style>
    /* Responsive Design */
    @media (max-width: 768px) {
      .desktop-only {
        display: none !important;
      }
      .mobile-only {
        display: block !important;
      }
    }
    
    @media (min-width: 769px) {
      .desktop-only {
        display: block !important;
      }
      .mobile-only {
        display: none !important;
      }
    }
    
    /* Mobile optimizations */
    @media (max-width: 480px) {
      .mobile-only {
        padding: 0 1rem;
      }
      
      .mobile-only > div {
        margin-bottom: 0.75rem;
        padding: 0.75rem;
      }
      
      .mobile-only img {
        width: 60px !important;
        height: 60px !important;
      }
      
      .mobile-only .grid {
        grid-template-columns: 1fr !important;
        gap: 0.5rem !important;
      }
    }
  </style>

  <div style="padding: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h2 style="margin: 0; color: #f9fafb;">Admin Items</h2>
      {#if searchTerm}
        <div style="color: #9ca3af; font-size: 0.875rem;">
          {items.length} Treffer gefunden
        </div>
      {/if}
    </div>
    
    <!-- Search -->
    <div style="margin-bottom: 2rem;">
      <div style="display: flex; gap: 1rem;">
        <input
          type="text"
          placeholder="Suche nach Titel, Slug oder Benutzer... (mehrere Begriffe mit Leerzeichen trennen)"
          bind:value={searchTerm}
          on:keydown={handleSearchKeydown}
          style="flex: 1; padding: 12px; border: 2px solid #374151; border-radius: 8px; background: #1f2937; color: #f9fafb; font-size: 14px;"
        />
      </div>

    </div>

    <!-- Desktop Table View (hidden on mobile) -->
    <div style="overflow-x: auto; display: none;" class="desktop-only">
      <table style="width: 100%; border-collapse: collapse; background: #1f2937; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #111827;">
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Treffer</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Benutzer</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Erstellt</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Privacy</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item}
            <tr style="border-bottom: 1px solid #374151;">
              <!-- Item Column -->
              <td style="padding: 12px; vertical-align: top;">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                  {#if item.path_512}
                    <img 
                      src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`}
                      alt={item.title || 'Bild'}
                      style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0;"
                    />
                  {:else}
                    <div style="width: 60px; height: 60px; background: #374151; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 0.75rem;">
                      Kein Bild
                    </div>
                  {/if}
                  <div style="flex: 1;">
                    <div style="font-weight: 500; color: #f9fafb; margin-bottom: 4px;">
                      {item.title || 'Unbenannt'}
                    </div>
                    <a 
                      href="/item/{item.slug}" 
                      style="color: #f59e0b; text-decoration: none; font-size: 0.875rem;"
                      target="_blank"
                    >
                      {item.slug}
                    </a>
                  </div>
                </div>
              </td>

              <!-- User Column -->
              <td style="padding: 12px; vertical-align: top;">
                <a 
                  href="/?user={item.user_id}" 
                  style="color: #f59e0b; text-decoration: none; font-weight: 500;"
                >
                  {item.profiles?.accountname || 'Unbekannt'}
                </a>
                <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px;">
                  {item.width} × {item.height}
                </div>
              </td>

              <!-- Created Column -->
              <td style="padding: 12px; vertical-align: top;">
                <div style="color: #f9fafb;">
                  {formatDate(item.created_at)}
                </div>
                {#if item.lat && item.lon}
                  <button 
                    on:click={() => openMapForGPS(item)}
                    style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; font-family: monospace; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0;"
                    title="Auf Karte anzeigen"
                  >
                    {item.lat.toFixed(2)}, {item.lon.toFixed(2)}
                  </button>
                {:else}
                  <button 
                    on:click={() => openGPSModal(item)}
                    style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; font-family: monospace; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0;"
                    title="GPS-Koordinaten setzen"
                  >
                    GPS: -
                  </button>
                {/if}
              </td>

              <!-- Privacy Column -->
              <td style="padding: 12px; vertical-align: top;">
                <button
                  on:click={() => togglePrivacy(item)}
                  style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; border: none; cursor: pointer; background: {item.is_private ? '#dc2626' : '#059669'}; color: white;"
                >
                  {item.is_private ? 'Privat' : 'Öffentlich'}
                </button>
              </td>

              <!-- Actions Column -->
              <td style="padding: 12px; vertical-align: top;">
                <div style="display: flex; gap: 8px;">
                  <button
                    on:click={() => openOwnerModal(item)}
                    style="padding: 6px 12px; font-size: 0.75rem; background: #f59e0b; border: none; border-radius: 4px; color: white; cursor: pointer;"
                  >
                    Besitzer
                  </button>
                  <button
                    on:click={() => deleteItem(item)}
                    style="padding: 6px 12px; font-size: 0.75rem; background: #dc2626; border: none; border-radius: 4px; color: white; cursor: pointer;"
                  >
                    Löschen
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View (hidden on desktop) -->
    <div class="mobile-only">
      {#each items as item}
        <div style="background: #1f2937; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border: 1px solid #374151;">
          <!-- Item Header with Image -->
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 1rem;">
            {#if item.path_512}
              <img 
                src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`}
                alt={item.title || 'Bild'}
                style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; flex-shrink: 0;"
              />
            {:else}
              <div style="width: 80px; height: 80px; background: #374151; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 0.75rem;">
                Kein Bild
              </div>
            {/if}
            <div style="flex: 1;">
              <div style="font-weight: 500; color: #f9fafb; margin-bottom: 4px; font-size: 1rem;">
                {item.title || 'Unbenannt'}
              </div>
              <a 
                href="/item/{item.slug}" 
                style="color: #f59e0b; text-decoration: none; font-size: 0.875rem;"
                target="_blank"
              >
                {item.slug}
              </a>
            </div>
          </div>

          <!-- Item Details -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;" class="grid">
            <div>
              <div style="font-size: 0.875rem; color: #9ca3af; margin-bottom: 4px;">Benutzer</div>
              <a 
                href="/?user={item.user_id}" 
                style="color: #f59e0b; text-decoration: none; font-weight: 500;"
              >
                {item.profiles?.accountname || 'Unbekannt'}
              </a>
              <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px;">
                {item.width} × {item.height}
              </div>
            </div>
            
            <div>
              <div style="font-size: 0.875rem; color: #9ca3af; margin-bottom: 4px;">Erstellt</div>
              <div style="color: #f9fafb;">
                {formatDate(item.created_at)}
              </div>
              {#if item.lat && item.lon}
                <button 
                  on:click={() => openMapForGPS(item)}
                  style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; font-family: monospace; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0;"
                  title="Auf Karte anzeigen"
                >
                  {item.lat.toFixed(2)}, {item.lon.toFixed(2)}
                </button>
              {:else}
                <button 
                  on:click={() => openGPSModal(item)}
                  style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; font-family: monospace; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0;"
                  title="GPS-Koordinaten setzen"
                >
                  GPS: -
                </button>
              {/if}
            </div>
          </div>

          <!-- Privacy and Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <button
              on:click={() => togglePrivacy(item)}
              style="padding: 6px 12px; font-size: 0.875rem; border-radius: 4px; border: none; cursor: pointer; background: {item.is_private ? '#dc2626' : '#059669'}; color: white;"
            >
              {item.is_private ? 'Privat' : 'Öffentlich'}
            </button>
            
            <div style="display: flex; gap: 0.5rem;">
              <button
                on:click={() => openOwnerModal(item)}
                style="padding: 6px 12px; font-size: 0.875rem; background: #f59e0b; border: none; border-radius: 4px; color: white; cursor: pointer;"
              >
                Besitzer
              </button>
              <button
                on:click={() => deleteItem(item)}
                style="padding: 6px 12px; font-size: 0.875rem; background: #dc2626; border: none; border-radius: 4px; color: white; cursor: pointer;"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding: 1rem; background: #1f2937; border-radius: 8px;">
        <div style="color: #9ca3af; font-size: 0.875rem;">
          Seite {currentPage + 1} von {totalPages} ({totalItems} Items insgesamt)
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button 
            on:click={() => goToPage(0)}
            disabled={currentPage === 0}
            style="padding: 0.5rem 1rem; background: #374151; color: #f9fafb; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; opacity: 1;"
            on:disabled={(e) => e.target.style.opacity = '0.5'}
          >
            ⏮️ Erste
          </button>
          <button 
            on:click={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0}
            style="padding: 0.5rem 1rem; background: #374151; color: #f9fafb; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; opacity: 1;"
            on:disabled={(e) => e.target.style.opacity = '0.5'}
          >
            ⏪ Zurück
          </button>
          <span style="padding: 0.5rem 1rem; background: #f59e0b; color: #1f2937; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">
            {currentPage + 1}
          </span>
          <button 
            on:click={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            style="padding: 0.5rem 1rem; background: #374151; color: #f9fafb; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; opacity: 1;"
            on:disabled={(e) => e.target.style.opacity = '0.5'}
          >
            Weiter ⏩
          </button>
          <button 
            on:click={() => goToPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            style="padding: 0.5rem 1rem; background: #374151; color: #f9fafb; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; opacity: 1;"
            on:disabled={(e) => e.target.style.opacity = '0.5'}
          >
            Letzte ⏭️
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- Owner Change Modal -->
{#if showOwnerModal && editingItem}
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;" on:click={closeOwnerModal}>
    <div style="max-width: 500px; width: 90%; background: #1f2937; border: 2px solid #374151; border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); overflow: hidden;" on:click|stopPropagation>
      
      <!-- Header -->
      <div style="padding: 20px 20px 15px 20px; border-bottom: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; background: #111827;">
        <h3 style="margin: 0; font-size: 18px; color: #f9fafb; font-weight: 600;">Besitzer ändern</h3>
        <button 
          on:click={closeOwnerModal} 
          style="background: none; border: none; font-size: 20px; color: #9ca3af; cursor: pointer; padding: 5px; border-radius: 4px; transition: background-color 0.2s;"
          on:mouseenter={(e) => e.target.style.backgroundColor = '#374151'}
          on:mouseleave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ✕
        </button>
      </div>
      
      <!-- Content -->
      <div style="padding: 20px;">
        <!-- Item Info -->
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding: 15px; background: #374151; border-radius: 8px;">
          <div style="width: 60px; height: 60px; background: #4b5563; border-radius: 4px; flex-shrink: 0;"></div>
          <div style="flex: 1;">
            <h4 style="margin: 0 0 5px 0; font-size: 16px; color: #f9fafb; font-weight: 500;">
              {editingItem.title || 'Unbenannt'}
            </h4>
            <p style="margin: 0; color: #d1d5db; font-size: 14px;">
              Aktueller Besitzer: <strong>{getUserName(editingItem.user_id)}</strong>
            </p>
          </div>
        </div>
        
        <!-- User ID Input -->
        <div style="margin-bottom: 20px;">
          <label for="newUserId" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
            Neue User ID:
          </label>
          <input
            id="newUserId"
            type="text"
            bind:value={newUserId}
            placeholder="User ID eingeben..."
            on:keydown={(e) => e.key === 'Enter' && changeItemOwner()}
            style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-family: monospace; font-size: 14px; font-weight: 500; box-sizing: border-box;"
          />
          {#if userIdValidation}
            <div style="margin-top: 8px; font-size: 14px; font-weight: 500;">
              {userIdValidation}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Buttons -->
      <div style="padding: 15px 20px 20px 20px; border-top: 1px solid #374151; display: flex; justify-content: flex-end; gap: 12px; background: #111827;">
        <button 
          on:click={closeOwnerModal} 
          style="padding: 10px 20px; font-size: 14px; font-weight: 500; background: #4b5563; border: 1px solid #6b7280; color: #f9fafb; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
          on:mouseenter={(e) => e.target.style.backgroundColor = '#6b7280'}
          on:mouseleave={(e) => e.target.style.backgroundColor = '#4b5563'}
        >
          Abbrechen
        </button>
        <button
          disabled={!newUserId.trim() || userIdValidation.includes('❌')}
          on:click={changeItemOwner}
          style="padding: 10px 20px; font-size: 14px; font-weight: 500; background: #f59e0b; border: 1px solid #d97706; color: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; opacity: 1;"
          on:mouseenter={(e) => !e.target.disabled && (e.target.style.opacity = '0.8')}
          on:mouseleave={(e) => e.target.style.opacity = '1'}
          on:disabled={(e) => e.target.style.opacity = '0.5'}
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- GPS Location Modal -->
{#if showGPSModal && editingGPSItem}
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;" on:click={closeGPSModal}>
    <div style="max-width: 500px; width: 90%; background: #1f2937; border: 2px solid #374151; border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); overflow: hidden;" on:click|stopPropagation>
      
      <!-- Header -->
      <div style="padding: 20px 20px 15px 20px; border-bottom: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; background: #111827;">
        <h3 style="margin: 0; font-size: 18px; color: #f9fafb; font-weight: 600;">GPS Koordinaten ändern</h3>
        <button 
          on:click={closeGPSModal} 
          style="background: none; border: none; font-size: 20px; color: #9ca3af; cursor: pointer; padding: 5px; border-radius: 4px; transition: background-color 0.2s;"
          on:mouseenter={(e) => e.target.style.backgroundColor = '#374151'}
          on:mouseleave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ✕
        </button>
      </div>
      
      <!-- Content -->
      <div style="padding: 20px;">
        <!-- Item Info -->
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding: 15px; background: #374151; border-radius: 8px;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 5px 0; font-size: 16px; color: #f9fafb; font-weight: 500;">
              {editingGPSItem.title || 'Unbenannt'}
            </h4>
            <p style="margin: 0; color: #d1d5db; font-size: 14px;">
              Aktuelle Koordinaten: <strong>{editingGPSItem.lat?.toFixed(6) || 'keine'}, {editingGPSItem.lon?.toFixed(6) || 'keine'}</strong>
            </p>
          </div>
        </div>
        
        <!-- GPS Input Fields -->
        <div style="margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <label for="newLat" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
                Latitude:
              </label>
              <input
                id="newLat"
                type="number"
                step="any"
                bind:value={newLat}
                placeholder="z.B. 48.1351"
                style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-family: monospace; font-size: 14px; font-weight: 500; box-sizing: border-box;"
              />
            </div>
            <div>
              <label for="newLon" style="display: block; margin-bottom: 8px; font-weight: 600; color: #f9fafb; font-size: 14px;">
                Longitude:
              </label>
              <input
                id="newLon"
                type="number"
                step="any"
                bind:value={newLon}
                placeholder="z.B. 11.5820"
                style="width: 100%; padding: 12px; border: 2px solid #4b5563; border-radius: 8px; background: #374151; color: #f9fafb; font-family: monospace; font-size: 14px; font-weight: 500; box-sizing: border-box;"
              />
            </div>
          </div>
          
          <!-- Map Link -->
          <div style="margin-top: 15px; padding: 12px; background: #374151; border-radius: 8px; border: 1px solid #4b5563;">
            <p style="margin: 0 0 10px 0; color: #d1d5db; font-size: 14px;">
              💡 <strong>Tipp:</strong> Verwende eine Karten-App oder <a href="https://www.openstreetmap.org/" target="_blank" style="color: #f59e0b; text-decoration: underline;">OpenStreetMap</a> um die Koordinaten zu finden
            </p>
            {#if newLat && newLon}
              <a 
                href={`https://www.openstreetmap.org/?mlat=${newLat}&mlon=${newLon}&zoom=15`} 
                target="_blank"
                style="display: inline-block; padding: 8px 12px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 500;"
              >
                📍 Auf Karte anzeigen
              </a>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Buttons -->
      <div style="padding: 15px 20px 20px 20px; border-top: 1px solid #374151; display: flex; justify-content: flex-end; gap: 12px; background: #111827;">
        <button 
          on:click={closeGPSModal} 
          style="padding: 10px 20px; font-size: 14px; font-weight: 500; background: #4b5563; border: 1px solid #6b7280; color: #f9fafb; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
          on:mouseenter={(e) => e.target.style.backgroundColor = '#6b7280'}
          on:mouseleave={(e) => e.target.style.backgroundColor = '#4b5563'}
        >
          Abbrechen
        </button>
        <button
          disabled={!newLat || !newLon}
          on:click={saveGPSLocation}
          style="padding: 10px 20px; font-size: 14px; font-weight: 500; background: #f59e0b; border: 1px solid #d97706; color: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; opacity: 1;"
          on:mouseenter={(e) => !e.target.disabled && (e.target.style.opacity = '0.8')}
          on:mouseleave={(e) => e.target.style.opacity = '1'}
          on:disabled={(e) => e.target.style.opacity = '0.5'}
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
{/if} 