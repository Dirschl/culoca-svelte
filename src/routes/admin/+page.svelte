<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient.ts';
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';
  
  let user: any = null;
  let hasAdminPermission = false;
  let roles: any[] = [];
  let users: any[] = [];
  let loading = true;
  let error = '';
  
  // Role management
  let selectedRole = null;
  let editingRole = null;
  let newRole = {
    name: '',
    display_name: '',
    description: '',
    permissions: {
      view_gallery: true,
      view_items: true,
      view_maps: true,
      search: true,
      joystick: false,
      bulk_upload: false,
      settings: false,
      admin: false,
      delete_items: false,
      edit_items: false,
      create_items: false,
      manage_users: false,
      view_analytics: false,
      system_settings: false,
      public_content: false
    }
  };
  
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
          await loadData();
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
  
  // Load roles and users
  async function loadData() {
    try {
      // Load roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('id');
      
      if (rolesError) throw rolesError;
      roles = rolesData || [];
      
      // Load users with role info
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role_id,
          created_at,
          roles!inner(id, name, display_name)
        `)
        .order('created_at', { ascending: false });
      
      if (usersError) throw usersError;
      users = usersData || [];
      
    } catch (err) {
      error = 'Fehler beim Laden der Daten';
      console.error(err);
    }
  }
  
  // Update role permissions
  async function updateRolePermissions(roleId: number, permissions: any) {
    try {
      const { error } = await supabase
        .from('roles')
        .update({ permissions })
        .eq('id', roleId);
      
      if (error) throw error;
      
      // Reload data
      await loadData();
      
    } catch (err) {
      error = 'Fehler beim Aktualisieren der Rolle';
      console.error(err);
    }
  }
  
  // Update user role
  async function updateUserRole(userId: string, roleId: number) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role_id: roleId })
        .eq('id', userId);
      
      if (error) throw error;
      
      // Reload data
      await loadData();
      
    } catch (err) {
      error = 'Fehler beim Aktualisieren des Benutzers';
      console.error(err);
    }
  }
  
  onMount(() => {
    checkAdminPermission();
  });
</script>

<svelte:head>
  <title>Admin - Rollen-Management</title>
  <meta name="description" content="Admin-Bereich für Rollen- und Benutzer-Management" />
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
  <meta name="googlebot" content="noindex, nofollow" />
  <meta name="bingbot" content="noindex, nofollow" />
</svelte:head>

{#if loading}
  <div class="loading">Lade Admin-Bereich...</div>
{:else if !hasAdminPermission}
  <div class="error">
    <h1>Zugriff verweigert</h1>
    <p>{error}</p>
    <a href="/" class="btn">Zurück zur Startseite</a>
  </div>
{:else}
  <InfoPageLayout 
    currentPage="admin"
    title="Admin Dashboard"
    description="Übersicht über das System"
  >
    <div class="admin-content">
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <!-- Quick Stats -->
      <section class="stats-section">
        <h2>System-Statistiken</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Rollen</h3>
            <div class="stat-number">{roles.length}</div>
            <p>Verfügbare Rollen</p>
          </div>
          
          <div class="stat-card">
            <h3>Benutzer</h3>
            <div class="stat-number">{users.length}</div>
            <p>Registrierte Benutzer</p>
          </div>
          
          <div class="stat-card">
            <h3>Admins</h3>
            <div class="stat-number">{users.filter(u => u.role_id === 3).length}</div>
            <p>Administratoren</p>
          </div>
          
          <div class="stat-card">
            <h3>Normale Benutzer</h3>
            <div class="stat-number">{users.filter(u => u.role_id === 2).length}</div>
            <p>Standard-Benutzer</p>
          </div>
        </div>
      </section>
      
      <!-- Recent Users -->
      <section class="recent-section">
        <h2>Neueste Benutzer</h2>
        <div class="users-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Rolle</th>
              </tr>
            </thead>
            <tbody>
              {#each users.slice(0, 5) as user}
                <tr>
                  <td>{user.full_name || 'Unbekannt'}</td>
                  <td>{user.email}</td>
                  <td>
                    {#each roles as role}
                      {#if role.id === user.role_id}
                        {role.display_name}
                      {/if}
                    {/each}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
      
      <!-- System Info -->
      <section class="system-info">
        <h2>System-Informationen</h2>
        
        <div class="info-grid">
          <div class="info-card">
            <h3>Rollen-Übersicht</h3>
            <ul>
              {#each roles as role}
                <li>
                  <strong>{role.display_name}:</strong>
                  {users.filter(u => u.role_id === role.id).length} Benutzer
                </li>
              {/each}
            </ul>
          </div>
          
          <div class="info-card">
            <h3>Berechtigungen</h3>
            <ul>
              {#each roles as role}
                <li>
                  <strong>{role.display_name}:</strong>
                  {Object.entries(role.permissions).filter(([_, value]) => value).length} aktiv
                </li>
              {/each}
            </ul>
          </div>
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
    padding: 2rem;
  }
  
  .error-message {
    background: var(--error-bg);
    color: var(--error-color);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 2rem;
  }
  
  .stats-section {
    margin-bottom: 3rem;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
  }
  
  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
  }
  
  .stat-card h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .stat-number {
    font-size: 2.5rem;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }
  
  .recent-section {
    margin-bottom: 3rem;
  }
  
  .recent-section h2 {
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .admin-content h1 {
    margin-bottom: 2rem;
    color: var(--text-primary);
  }
  
  .error-message {
    background: var(--error-bg);
    color: var(--error-color);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 2rem;
  }
  
  section {
    margin-bottom: 3rem;
  }
  
  section h2 {
    margin-bottom: 1.5rem;
    color: var(--text-primary);
  }
  

  
  .users-table {
    overflow-x: auto;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow: hidden;
  }
  
  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  th {
    background: var(--bg-tertiary);
    font-weight: 600;
    color: var(--text-primary);
  }
  
  td {
    color: var(--text-secondary);
  }
  

  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }
  
  .info-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .info-card h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }
  
  .info-card ul {
    margin: 0;
    padding-left: 1.5rem;
  }
  
  .info-card li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
  }
  
  @media (max-width: 768px) {
    .admin-content {
      padding: 1rem;
    }
    
    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 