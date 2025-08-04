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
        const { data: hasPermission, error } = await supabase.rpc('has_permission', {
          user_id: user.id,
          permission_name: 'admin'
        });
        
        if (!error && hasPermission) {
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
  <InfoPageLayout 
    currentPage="admin"
    title="Admin - Rollen-Management"
    description="Verwalte Rollen und Benutzer-Berechtigungen"
  >
    <div class="admin-content">
      <h1>Admin-Bereich</h1>
      
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <!-- Roles Management -->
      <section class="roles-section">
        <h2>Rollen-Management</h2>
        
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
                <p>Benutzer mit dieser Rolle: {users.filter(u => u.role_id === role.id).length}</p>
              </div>
            </div>
          {/each}
        </div>
      </section>
      
      <!-- Users Management -->
      <section class="users-section">
        <h2>Benutzer-Management</h2>
        
        <div class="users-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Rolle</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user}
                <tr>
                  <td>{user.full_name || 'Unbekannt'}</td>
                  <td>{user.email}</td>
                  <td>
                    <select 
                      value={user.role_id || 1}
                      on:change={(e) => updateUserRole(user.id, parseInt(e.target.value))}
                    >
                      {#each roles as role}
                        <option value={role.id}>{role.display_name}</option>
                      {/each}
                    </select>
                  </td>
                  <td>
                    <button 
                      class="btn-small"
                      on:click={() => {
                        // Show user details
                        console.log('User details:', user);
                      }}
                    >
                      Details
                    </button>
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
            <h3>Statistiken</h3>
            <ul>
              <li>Rollen: {roles.length}</li>
              <li>Benutzer: {users.length}</li>
              <li>Admins: {users.filter(u => u.role_id === 3).length}</li>
              <li>Normale Benutzer: {users.filter(u => u.role_id === 2).length}</li>
              <li>Anonyme: {users.filter(u => u.role_id === 1 || !u.role_id).length}</li>
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
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
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