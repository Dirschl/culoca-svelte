<svelte:head>
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
  <meta name="googlebot" content="noindex, nofollow" />
  <meta name="bingbot" content="noindex, nofollow" />
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient.ts';
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';
  
  let user: any = null;
  let hasAdminPermission = false;
  let roles: any[] = [];
  let loading = true;
  let error = '';
  
  // Check admin permission
  async function checkAdminPermission() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user;
      
      if (user) {
        const { data: hasPermission, error: rpcError } = await supabase.rpc('has_permission', {
          user_id: user.id,
          permission_name: 'admin'
        });
        
        if (!rpcError && hasPermission) {
          hasAdminPermission = true;
          await loadRoles();
        } else {
          error = 'Keine Admin-Berechtigung';
        }
      } else {
        error = 'Nicht eingeloggt';
      }
    } catch (err) {
      error = 'Fehler beim Prüfen der Berechtigung';
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  // Load roles
  async function loadRoles() {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('id');
      
      if (rolesError) throw rolesError;
      roles = rolesData || [];
      
    } catch (err) {
      error = 'Fehler beim Laden der Rollen';
      console.error(err);
    }
  }
  
  // Update role permissions
  async function updateRolePermissions(roleId: number, permissions: any) {
    try {
      const { error: updateError } = await supabase
        .from('roles')
        .update({ permissions })
        .eq('id', roleId);
      
      if (updateError) throw updateError;
      
      await loadRoles();
      
    } catch (err) {
      error = 'Fehler beim Aktualisieren der Rolle';
      console.error(err);
    }
  }
  
  onMount(() => {
    checkAdminPermission();
  });
</script>

<svelte:head>
  <title>Admin - Rollen-Management</title>
  <meta name="description" content="Admin-Bereich für Rollen-Management" />
</svelte:head>

{#if loading}
  <div class="loading">Lade Rollen-Management...</div>
{:else if !hasAdminPermission}
  <div class="error">
    <h1>Zugriff verweigert</h1>
    <p>{error}</p>
    <a href="/" class="btn">Zurück zur Startseite</a>
  </div>
{:else}
  <InfoPageLayout 
    currentPage="admin"
    title="Rollen-Management"
    description="Verwalte Rollen und deren Berechtigungen"
  >
    <div class="admin-content">
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <!-- Roles Management -->
      <section class="roles-section">
        <h2>Rollen und Berechtigungen</h2>
        <div class="roles-grid">
          {#each roles as role}
            <div class="role-card">
              <h3>{role.display_name}</h3>
              <p class="role-description">{role.description}</p>
              
              <div class="permissions">
                <h4>Berechtigungen:</h4>
                {#each Object.entries(role.permissions) as [permission, value]}
                  <label class="permission-item">
                    <input 
                      type="checkbox" 
                      checked={value}
                      on:change={(e) => {
                        const newPermissions = { ...role.permissions };
                        newPermissions[permission] = e.target.checked;
                        updateRolePermissions(role.id, newPermissions);
                      }}
                    />
                    <span>{permission}</span>
                  </label>
                {/each}
              </div>
              
              <div class="role-stats">
                <p>Rollen-ID: {role.id}</p>
                <p>Name: {role.name}</p>
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </InfoPageLayout>
{/if}

<style>
  .loading, .error {
    text-align: center;
    padding: 2rem;
    font-size: 1.2rem;
  }
  
  .error {
    color: var(--error-color);
  }
  
  .admin-content {
    width: 100%;
    /* padding: 2rem; */
  }
  
  .error-message {
    background: var(--error-bg);
    color: var(--error-color);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 2rem;
  }
  
  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
  }
  
  .role-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .role-card h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .role-description {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .permissions h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .permission-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    font-size: 0.85rem;
  }
  
  .permission-item input[type="checkbox"] {
    margin: 0;
  }
  
  .role-stats {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .role-stats p {
    margin: 0.25rem 0;
  }
</style> 