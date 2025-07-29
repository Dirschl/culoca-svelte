<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';

  let isLoading = true;
  let isAdmin = false;
  let creating = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  
  // Form fields
  let email = '';
  let password = '';
  let fullName = '';
  let accountName = '';

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
    } else {
      console.log('Access denied for:', user?.email, 'ID:', user?.id);
      message = 'Zugriff verweigert. Nur Administratoren können Benutzer erstellen.';
      messageType = 'error';
    }
  });

  async function createUser() {
    if (!email || !password || !fullName) {
      message = 'Bitte füllen Sie alle Pflichtfelder aus.';
      messageType = 'error';
      return;
    }

    if (password.length < 6) {
      message = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
      messageType = 'error';
      return;
    }

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, fullName, accountName })
      });

      const result = await response.json();

      if (result.success) {
        message = `Benutzer "${result.user.full_name}" erfolgreich erstellt! E-Mail: ${result.user.email}`;
        messageType = 'success';
        email = '';
        password = '';
        fullName = '';
        accountName = '';
      } else {
        message = `Fehler beim Erstellen des Benutzers: ${result.error}`;
        messageType = 'error';
      }
    } catch (error) {
      console.error('Error creating user:', error);
      message = 'Fehler beim Erstellen des Benutzers. Bitte versuchen Sie es erneut.';
      messageType = 'error';
    }
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
          <h1 class="admin-title">Benutzer erstellen</h1>
          <p class="admin-subtitle">Neue Benutzerkonten manuell anlegen</p>
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
          <a href="/admin/create-user" class="admin-nav-link active">Benutzer erstellen</a>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="admin-main">
      <div class="admin-table-container">
        <div class="admin-table-header">
          <h3 class="admin-table-title">Neuen Benutzer erstellen</h3>
        </div>
        
        <div style="padding: 1.5rem;">
          {#if message}
            <div class="admin-btn {messageType === 'success' ? 'admin-btn-primary' : messageType === 'error' ? 'admin-btn-danger' : 'admin-btn-secondary'}" style="margin-bottom: 1rem; display: block; text-align: center;">
              {message}
            </div>
          {/if}

          <form on:submit|preventDefault={createUser} style="display: grid; gap: 1.5rem; max-width: 500px;">
            <div class="admin-form-group">
              <label for="email" class="admin-form-label">E-Mail *</label>
              <input
                id="email"
                type="email"
                bind:value={email}
                placeholder="benutzer@example.com"
                required
                class="admin-form-input"
              />
            </div>

            <div class="admin-form-group">
              <label for="password" class="admin-form-label">Passwort *</label>
              <input
                id="password"
                type="password"
                bind:value={password}
                placeholder="Mindestens 6 Zeichen"
                required
                minlength="6"
                class="admin-form-input"
              />
            </div>

            <div class="admin-form-group">
              <label for="fullName" class="admin-form-label">Vollständiger Name *</label>
              <input
                id="fullName"
                type="text"
                bind:value={fullName}
                placeholder="Max Mustermann"
                required
                class="admin-form-input"
              />
            </div>

            <div class="admin-form-group">
              <label for="accountName" class="admin-form-label">Account Name (optional)</label>
              <input
                id="accountName"
                type="text"
                bind:value={accountName}
                placeholder="maxmustermann"
                class="admin-form-input"
              />
              <small style="font-size: 0.75rem; color: var(--admin-text-light);">
                Falls leer, wird der vollständige Name verwendet
              </small>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
              <button type="submit" class="admin-btn admin-btn-primary">
                Benutzer erstellen
              </button>
              <button type="button" class="admin-btn admin-btn-secondary" on:click={() => goto('/admin/users')}>
                Abbrechen
              </button>
            </div>
          </form>

          <div style="margin-top: 2rem; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid var(--admin-border);">
            <h4 style="margin: 0 0 0.5rem 0; color: var(--admin-text);">Hinweise:</h4>
            <ul style="margin: 0; padding-left: 1.5rem; color: var(--admin-text-light); font-size: 0.875rem;">
              <li>Der Benutzer wird automatisch bestätigt und kann sich sofort anmelden</li>
              <li>Das Profil wird automatisch mit Standardeinstellungen erstellt</li>
              <li>Der Benutzer kann später Google OAuth zu seinem Account hinzufügen</li>
              <li>Alle Pflichtfelder müssen ausgefüllt werden</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  </div>
{/if} 