<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  let isLoading = true;
  let isAdmin = false;
  let items: any[] = [];
  let users: any[] = [];
  let filteredItems: any[] = [];
  let searchTerm = '';
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
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        
        console.log('Profile data:', profile, 'Error:', error);
        isAdmin = profile?.is_admin || false;
        console.log('Is admin:', isAdmin);
        
        // TEMPORARY: Allow admin access for testing
        if (!isAdmin && user.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09') {
          console.log('Temporary admin access granted for testing');
          isAdmin = true;
        }
      }

      if (isAdmin) {
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
      const { data, error } = await supabase
        .from('items')
        .select(`
          id, title, slug, created_at, lat, lon, is_private, user_id, width, height, path_512,
          profiles(accountname, full_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      items = data || [];
      filteredItems = [...items];
    } catch (error) {
      console.error('Error loading items:', error);
    }
  }

  async function validateUserId(userId: string) {
    if (!userId.trim()) {
      userIdValidation = '';
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, accountname, full_name')
        .eq('id', userId)
        .single();

      if (error || !data) {
        userIdValidation = '❌ Benutzer nicht gefunden';
        return false;
      }

      userIdValidation = `✅ ${data.accountname} (${data.full_name})`;
      return true;
    } catch (error) {
      userIdValidation = '❌ Benutzer nicht gefunden';
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
      filteredItems = filteredItems.filter(i => i.id !== item.id);
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

  // Filter items based on search term
  $: {
    if (searchTerm.trim()) {
      filteredItems = items.filter(item => 
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.profiles?.accountname?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      filteredItems = [...items];
    }
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
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h1 style="margin: 0; color: #f9fafb; font-size: 1.5rem;">Admin Dashboard</h1>
      <nav style="display: flex; gap: 1rem;">
        <a href="/admin/items" style="color: #f59e0b; text-decoration: none; font-weight: 500; padding: 0.5rem 1rem; border-radius: 4px; background: #374151;">Items</a>
        <a href="/admin/users" style="color: #9ca3af; text-decoration: none; font-weight: 500; padding: 0.5rem 1rem; border-radius: 4px;">Users</a>
        <a href="/" style="color: #9ca3af; text-decoration: none; font-weight: 500; padding: 0.5rem 1rem; border-radius: 4px;">Galerie</a>
      </nav>
    </div>
  </div>

  <div style="padding: 2rem;">
    <h2 style="margin: 0 0 1rem 0; color: #f9fafb;">Admin Items</h2>
    
    <!-- Search -->
    <div style="margin-bottom: 2rem;">
      <input
        type="text"
        placeholder="Suche nach Titel, Slug oder Benutzer..."
        bind:value={searchTerm}
        style="width: 100%; padding: 12px; border: 2px solid #374151; border-radius: 8px; background: #1f2937; color: #f9fafb; font-size: 14px;"
      />
    </div>

    <!-- Items Table -->
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; background: #1f2937; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #111827;">
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Item</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Benutzer</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Erstellt</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Privacy</th>
            <th style="padding: 12px; text-align: left; color: #f9fafb; font-weight: 600; border-bottom: 1px solid #374151;">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredItems as item}
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

    {#if filteredItems.length === 0}
      <div style="text-align: center; padding: 2rem; color: #9ca3af;">
        {searchTerm ? 'Keine Items gefunden.' : 'Keine Items vorhanden.'}
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