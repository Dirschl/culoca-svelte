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
      system_settings: false
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
          roles!inner(id, name, display_name)
        `)
        .order('full_name');
      
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
  <div class="admin-layout">
    <!-- Admin Navigation -->
    <nav class="admin-nav">
      <div class="nav-header">
        <h1>Admin-Bereich</h1>
      </div>
      <ul class="nav-links">
        <li><a href="/admin" class="nav-link active">Dashboard</a></li>
        <li><a href="/admin/roles" class="nav-link">Rollen</a></li>
        <li><a href="/admin/users" class="nav-link">Benutzer</a></li>
        <li><a href="/admin/items" class="nav-link">Items</a></li>
        <li><a href="/admin/analytics" class="nav-link">Analytics</a></li>
      </ul>
    </nav>

    <!-- Main Content -->
    <main class="admin-content">
      <div class="content-header">
        <h2>Dashboard</h2>
        <p>Übersicht über das System</p>
      </div>
      
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <!-- Quick Stats -->
      <section class="stats-section">
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Rollen</h3>
            <div class="stat-number">{roles.length}</div>
            <a href="/admin/roles" class="stat-link">Verwalten →</a>
          </div>
          
          <div class="stat-card">
            <h3>Benutzer</h3>
            <div class="stat-number">{users.length}</div>
            <a href="/admin/users" class="stat-link">Verwalten →</a>
          </div>
          
          <div class="stat-card">
            <h3>Admins</h3>
            <div class="stat-number">{users.filter(u => u.role_id === 3).length}</div>
            <a href="/admin/users" class="stat-link">Anzeigen →</a>
          </div>
          
          <div class="stat-card">
            <h3>Items</h3>
            <div class="stat-number">-</div>
            <a href="/admin/items" class="stat-link">Verwalten →</a>
          </div>
        </div>
      </section>
      
      <!-- Recent Users -->
      <section class="recent-section">
        <h3>Neueste Benutzer</h3>
        <div class="users-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Rolle</th>
                <th>Erstellt</th>
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
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="section-footer">
          <a href="/admin/users" class="btn">Alle Benutzer anzeigen</a>
        </div>
      </section>
      
      <!-- System Info -->
      <section class="system-info">
        <h3>System-Informationen</h3>
        
        <div class="info-grid">
          <div class="info-card">
            <h4>Rollen-Übersicht</h4>
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
            <h4>Berechtigungen</h4>
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
    </main>
  </div>
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
  
  .admin-layout {
    display: flex;
    min-height: 100vh;
  }
  
  .admin-nav {
    width: 250px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    padding: 1rem;
  }
  
  .nav-header h1 {
    margin: 0 0 2rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .nav-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .nav-link {
    display: block;
    padding: 0.75rem 1rem;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    transition: all 0.2s;
  }
  
  .nav-link:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .nav-link.active {
    background: var(--primary-color);
    color: white;
  }
  
  .admin-content {
    flex: 1;
    padding: 2rem;
  }
  
  .content-header {
    margin-bottom: 2rem;
  }
  
  .content-header h2 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .content-header p {
    color: var(--text-secondary);
    margin: 0;
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
  
  .stat-link {
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.9rem;
  }
  
  .stat-link:hover {
    text-decoration: underline;
  }
  
  .recent-section {
    margin-bottom: 3rem;
  }
  
  .recent-section h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .section-footer {
    margin-top: 1rem;
    text-align: center;
  }
  
  .section-footer .btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  
  .section-footer .btn:hover {
    background: var(--primary-hover);
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
  
  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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
  
  select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .btn-small {
    padding: 0.25rem 0.5rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  
  .btn-small:hover {
    opacity: 0.9;
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
    
    .roles-grid {
      grid-template-columns: 1fr;
    }
    
    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 