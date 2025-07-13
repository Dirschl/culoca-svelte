<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let user: any = null;
  let profile: any = null;
  let loading = true;
  let saving = false;
  let error = '';
  let success = '';
  let avatarFile: File | null = null;
  let avatarPreview: string | null = null;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Profile fields
  let name = '';
  let address = '';
  let phone = '';
  let website = '';
  let instagram = '';
  let facebook = '';
  let twitter = '';
  let visible = true;
  let show_phone = false;
  let show_address = false;
  let show_website = false;
  let show_social = false;
  let email = '';
  let show_email = false;
  let accountname = '';
  let accountnameChecking = false;
  let accountnameAvailable = true;
  let accountnameMessage = '';
  let accountnameTimeout: NodeJS.Timeout;
  let privacy_mode = 'public'; // 'public', 'private', 'all'

  let errorLogExists = false;
  let errorLogUrl = '';
  let userId = '';
  let errorLogFiles: string[] = [];

  $: nameValid = name.length >= 2 && name.length <= 60;
  $: phoneValid = phone.length === 0 || /^\+?[0-9\- ]{7,20}$/.test(phone);
  $: websiteValid = website.length === 0 || website.startsWith('http');
  $: instagramValid = instagram.length === 0 || instagram.startsWith('https://');
  $: facebookValid = facebook.length === 0 || facebook.startsWith('https://');
  $: twitterValid = twitter.length === 0 || twitter.startsWith('https://');
  $: accountnameValid = accountname.length === 0 || (accountname.length >= 3 && accountname.length <= 30 && /^[a-z0-9_-]+$/.test(accountname));
  
  // Reserved accountnames that can't be used
  const reservedAccountnames = [
    'admin', 'api', 'www', 'mail', 'support', 'help', 'info', 'contact', 'about', 'privacy', 'terms',
    'login', 'logout', 'signup', 'register', 'auth', 'callback', 'profile', 'settings', 'dashboard',
    'user', 'users', 'account', 'accounts', 'home', 'index', 'root', 'blog', 'news', 'events',
    'upload', 'uploads', 'download', 'downloads', 'file', 'files', 'image', 'images', 'photo', 'photos',
    'item', 'items', 'gallery', 'map', 'search', 'explore', 'discover', 'trending', 'popular',
    'debug', 'test', 'dev', 'staging', 'production', 'app', 'mobile', 'web', 'static', 'assets',
    'css', 'js', 'img', 'fonts', 'icons', 'favicon', 'robots', 'sitemap', 'manifest',
    'bulk-upload', 'simulation', 'newsflash', 'filter', 'location'
  ];
  
  $: isReservedAccountname = reservedAccountnames.includes(accountname.toLowerCase());

  onMount(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      goto('/');
      return;
    }
    user = currentUser;
    await loadProfile();
    loading = false;
    userId = user.id;
    const { data, error } = await supabase.storage.from('errorlogs').list('');
    if (data) {
      errorLogFiles = data.map((f: any) => f.name);
      if (data.find((f: any) => f.name === `${user.id}.json`)) {
        errorLogExists = true;
        const { data: urlData } = await supabase.storage.from('errorlogs').createSignedUrl(`${user.id}.json`, 60);
        if (urlData?.signedUrl) errorLogUrl = urlData.signedUrl;
      }
    }
  });

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        profile = data;
        name = data.full_name || '';
        address = data.address || '';
        phone = data.phone || '';
        website = data.website || '';
        instagram = data.instagram || '';
        facebook = data.facebook || '';
        twitter = data.twitter || '';
        email = data.email || '';
        accountname = data.accountname || '';
        privacy_mode = data.privacy_mode || 'public';
        show_address = data.show_address ?? false;
        show_phone = data.show_phone ?? false;
        show_website = data.show_website ?? false;
        show_social = data.show_social ?? false;
        show_email = data.show_email ?? false;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  function handleAvatarChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      avatarFile = input.files[0];
      avatarPreview = URL.createObjectURL(avatarFile);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return null;
    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile);
      if (error) throw error;
      return fileName;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  function debouncedCheckAccountname() {
    if (accountnameTimeout) {
      clearTimeout(accountnameTimeout);
    }
    
    accountnameTimeout = setTimeout(() => {
      checkAccountnameAvailability();
    }, 500);
  }

  async function checkAccountnameAvailability() {
    if (!accountname || !accountnameValid || isReservedAccountname) {
      accountnameAvailable = false;
      accountnameMessage = '';
      return;
    }
    
    accountnameChecking = true;
    accountnameMessage = '';
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('accountname', accountname.toLowerCase())
        .neq('id', user.id);
        
      if (error) throw error;
      
      accountnameAvailable = data.length === 0;
      if (!accountnameAvailable) {
        accountnameMessage = 'Dieser Accountname ist bereits vergeben';
      } else {
        accountnameMessage = 'Accountname ist verfügbar';
      }
    } catch (error) {
      console.error('Error checking accountname:', error);
      accountnameAvailable = false;
      accountnameMessage = 'Fehler bei der Überprüfung';
    } finally {
      accountnameChecking = false;
    }
  }

  async function saveProfile() {
    saving = true;
    message = '';
    try {
      // Check accountname availability before saving if accountname is set
      if (accountname && (!accountnameAvailable || isReservedAccountname)) {
        showMessage('Bitte wähle einen gültigen und verfügbaren Accountname', 'error');
        saving = false;
        return;
      }
      
      let avatarPath = profile?.avatar_url;
      if (avatarFile) {
        avatarPath = await uploadAvatar();
      }
      
      // Check if privacy mode changed to sync items
      const oldPrivacyMode = profile?.privacy_mode;
      const privacyModeChanged = oldPrivacyMode !== privacy_mode;
      
      const profileData = {
        id: user.id,
        full_name: name,
        address,
        phone,
        website,
        instagram,
        facebook,
        twitter,
        accountname: accountname ? accountname.toLowerCase() : null,
        privacy_mode: privacy_mode,
        show_address: show_address,
        show_phone: show_phone,
        show_website: show_website,
        show_social: show_social,
        avatar_url: avatarPath,
        updated_at: new Date().toISOString(),
        email,
        show_email
      };
      
      // Update profile
      const { error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });
      if (error) throw error;
      
      // Sync is_private field in items table if privacy mode changed
      if (privacyModeChanged) {
        console.log('Privacy mode changed, syncing items...');
        await syncItemsPrivacy();
      }
      
      profile = profileData;
      showMessage('Profil erfolgreich gespeichert!', 'success');
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        avatarPreview = null;
      }
      avatarFile = null;
    } catch (error) {
      console.error('Error saving profile:', error);
      showMessage('Fehler beim Speichern des Profils', 'error');
    } finally {
      saving = false;
    }
  }

  async function syncItemsPrivacy() {
    try {
      // Update is_private field in all user's items based on privacy mode
      // Only 'private' mode makes items private, all other modes (public, closed, all) are public
      const isPrivate = privacy_mode === 'private';
      
      const { error } = await supabase
        .from('items')
        .update({ is_private: isPrivate })
        .eq('profile_id', user.id);
      
      if (error) throw error;
      
      console.log(`Updated is_private field to ${isPrivate} for all items of user ${user.id} (privacy_mode: ${privacy_mode})`);
    } catch (error) {
      console.error('Error syncing items privacy:', error);
      throw error;
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function getAvatarUrl() {
    if (avatarPreview) return avatarPreview;
    if (profile?.avatar_url) {
      if (profile.avatar_url.startsWith('http')) {
        return profile.avatar_url;
      } else {
        return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`;
      }
    }
    return null;
  }

  async function downloadErrorLog() {
    if (errorLogUrl) {
      window.open(errorLogUrl, '_blank');
    }
  }

  async function deleteErrorLog() {
    if (!userId) return;
    await supabase.storage.from('errorlogs').remove([`${userId}.json`]);
    errorLogExists = false;
    errorLogUrl = '';
  }

  function goHome() {
    goto('/');
  }

  async function signOut() {
    await supabase.auth.signOut();
    goto('/');
  }
</script>

<svelte:head>
  <title>Mein Profil - Culoca</title>
</svelte:head>

<div class="profile-page">
  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <span>Lade Profil...</span>
    </div>
  {:else}
    <div class="profile-container">
      <!-- Header mit Zurück-Button -->
      <div class="profile-header">
        <button class="back-btn" on:click={goHome} aria-label="Zurück zur Startseite">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Zurück
        </button>
        <h1 class="page-title">Mein Profil</h1>
        <button class="signout-btn" on:click={signOut}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          </svg>
          Abmelden
        </button>
      </div>

      <!-- Hauptinhalt -->
      <div class="profile-content">
        <!-- Avatar-Sektion -->
        <div class="avatar-section">
          <div class="avatar-container">
            {#if getAvatarUrl()}
              <img src={getAvatarUrl()} alt="Profilbild" class="profile-avatar" />
            {:else}
              <div class="avatar-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M2 20c0-4 8-6 10-6s10 2 10 6"/>
                </svg>
              </div>
            {/if}
            <div class="avatar-actions">
              <label for="avatar-input" class="avatar-btn primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                {getAvatarUrl() ? 'Ändern' : 'Hochladen'}
              </label>
              {#if getAvatarUrl()}
                <button type="button" class="avatar-btn secondary" on:click={() => {
                  avatarFile = null;
                  avatarPreview = null;
                  profile.avatar_url = null;
                }}>
                  Entfernen
                </button>
              {/if}
            </div>
            <input 
              id="avatar-input" 
              type="file" 
              accept="image/*" 
              on:change={handleAvatarChange}
              class="hidden"
            />
          </div>
          <div class="user-info">
            <h2 class="user-name">{name || 'Unbekannter Benutzer'}</h2>
            <p class="user-email">{user.email}</p>
          </div>
        </div>

        <!-- Profil-Formular -->
        <form class="profile-form" on:submit|preventDefault={saveProfile}>
          <!-- Persönliche Informationen -->
          <div class="card">
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              Persönliche Informationen
            </h3>
            <div class="form-group">
              <label for="fullName">Vollständiger Name</label>
              <input 
                id="fullName" 
                type="text" 
                bind:value={name} 
                placeholder="Dein vollständiger Name"
                class:valid={nameValid}
                class:invalid={name.length > 0 && !nameValid}
              />
              {#if name.length > 0 && !nameValid}
                <span class="error-text">Name muss zwischen 2 und 60 Zeichen lang sein</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="accountname">Accountname (für Permalinks)</label>
              <div class="accountname-input-group">
                <span class="url-prefix">culoca.com/</span>
                <input 
                  id="accountname" 
                  type="text" 
                  bind:value={accountname} 
                  placeholder="mein-accountname"
                  class:valid={accountnameValid && accountnameAvailable && !isReservedAccountname && accountname.length > 0}
                  class:invalid={accountname.length > 0 && (!accountnameValid || isReservedAccountname || !accountnameAvailable)}
                  on:input={debouncedCheckAccountname}
                  on:blur={checkAccountnameAvailability}
                />
                {#if accountnameChecking}
                  <div class="checking-spinner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="animate-spin">
                      <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
                      <path d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"/>
                    </svg>
                  </div>
                {/if}
              </div>
              {#if accountname.length > 0}
                {#if !accountnameValid}
                  <span class="error-text">3-30 Zeichen, nur Kleinbuchstaben, Zahlen, Bindestriche und Unterstriche</span>
                {:else if isReservedAccountname}
                  <span class="error-text">Dieser Accountname ist reserviert</span>
                {:else if accountnameMessage}
                  <span class="success-text" class:error-text={!accountnameAvailable}>{accountnameMessage}</span>
                {/if}
              {:else}
                <span class="help-text">Optional: Erstelle einen personalisierten Link zu deinem Profil</span>
              {/if}
            </div>
          </div>

          <!-- Privatsphäre-Einstellungen -->
          <div class="card">
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
              Privatsphäre-Einstellungen
            </h3>
            <div class="form-group">
              <label for="privacy-mode">Permalink-Verhalten</label>
              <select id="privacy-mode" bind:value={privacy_mode}>
                <option value="public">Public - Jeder kann dein Profil sehen und Filter entfernen</option>
                <option value="closed">Closed - User können nur dein Profil sehen</option>
                <option value="private">Private - Nur du kannst dein Profil sehen</option>
                <option value="all">All - Besucher sehen alle Inhalte ohne Filter</option>
              </select>
              <div class="privacy-explanation">
                {#if privacy_mode === 'public'}
                  <p class="help-text">
                    <strong>Public:</strong> Dein Permalink zeigt nur deine Bilder an. Besucher können den Filter entfernen, um alle Bilder zu sehen.
                  </p>
                {:else if privacy_mode === 'closed'}
                  <p class="help-text">
                    <strong>Closed:</strong> Dein Permalink zeigt nur deine Bilder an. Besucher können den Filter nicht entfernen - sie sehen nur deine Inhalte.
                  </p>
                {:else if privacy_mode === 'private'}
                  <p class="help-text">
                    <strong>Private:</strong> So nimmst du sofort alle Bilder aus der Sichtbarkeit, Detailseite wird umgeleitet.
                  </p>
                {:else if privacy_mode === 'all'}
                  <p class="help-text">
                    <strong>All:</strong> Dein Permalink zeigt alle Bilder der Plattform an. Besucher sehen die komplette Culoca-Galerie.
                  </p>
                {/if}
              </div>
            </div>
          </div>

          <!-- Kontakt & Info -->
          <div class="card">
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Kontakt & Info
            </h3>
            
            <div class="form-group">
              <label for="address">Adresse</label>
              <textarea 
                id="address" 
                bind:value={address} 
                placeholder="Deine Adresse" 
                rows="2"
              ></textarea>
              <label class="toggle-label">
                <input type="checkbox" bind:checked={show_address} />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Adresse öffentlich anzeigen</span>
              </label>
            </div>

            <div class="form-group">
              <label for="phone">Telefonnummer</label>
              <input 
                id="phone" 
                type="tel" 
                bind:value={phone} 
                placeholder="Deine Telefonnummer"
                class:valid={phoneValid}
                class:invalid={phone.length > 0 && !phoneValid}
              />
              {#if phone.length > 0 && !phoneValid}
                <span class="error-text">Ungültige Telefonnummer</span>
              {/if}
              <label class="toggle-label">
                <input type="checkbox" bind:checked={show_phone} />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Telefonnummer öffentlich anzeigen</span>
              </label>
            </div>

            <div class="form-group">
              <label for="email">E-Mail</label>
              <input 
                id="email" 
                type="email" 
                bind:value={email} 
                placeholder="Deine E-Mail-Adresse"
              />
              <label class="toggle-label">
                <input type="checkbox" bind:checked={show_email} />
                <span class="toggle-switch"></span>
                <span class="toggle-text">E-Mail öffentlich anzeigen</span>
              </label>
            </div>

            <div class="form-group">
              <label for="website">Webseite</label>
              <input 
                id="website" 
                type="url" 
                bind:value={website} 
                placeholder="https://deine-website.de"
                class:valid={websiteValid}
                class:invalid={website.length > 0 && !websiteValid}
              />
              {#if website.length > 0 && !websiteValid}
                <span class="error-text">URL muss mit http:// oder https:// beginnen</span>
              {/if}
              <label class="toggle-label">
                <input type="checkbox" bind:checked={show_website} />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Webseite öffentlich anzeigen</span>
              </label>
            </div>
          </div>

          <!-- Social Media -->
          <div class="card">
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/>
              </svg>
              Social Media
            </h3>
            
            <div class="form-group">
              <label for="facebook">Facebook</label>
              <input 
                id="facebook" 
                type="url" 
                bind:value={facebook} 
                placeholder="https://facebook.com/dein-profil"
                class:valid={facebookValid}
                class:invalid={facebook.length > 0 && !facebookValid}
              />
              {#if facebook.length > 0 && !facebookValid}
                <span class="error-text">URL muss mit https:// beginnen</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="instagram">Instagram</label>
              <input 
                id="instagram" 
                type="url" 
                bind:value={instagram} 
                placeholder="https://instagram.com/dein-profil"
                class:valid={instagramValid}
                class:invalid={instagram.length > 0 && !instagramValid}
              />
              {#if instagram.length > 0 && !instagramValid}
                <span class="error-text">URL muss mit https:// beginnen</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="twitter">Twitter/X</label>
              <input 
                id="twitter" 
                type="url" 
                bind:value={twitter} 
                placeholder="https://twitter.com/dein-profil"
                class:valid={twitterValid}
                class:invalid={twitter.length > 0 && !twitterValid}
              />
              {#if twitter.length > 0 && !twitterValid}
                <span class="error-text">URL muss mit https:// beginnen</span>
              {/if}
            </div>

            <label class="toggle-label">
              <input type="checkbox" bind:checked={show_social} />
              <span class="toggle-switch"></span>
              <span class="toggle-text">Social Media Links öffentlich anzeigen</span>
            </label>
          </div>

          <!-- Speichern Button -->
          <div class="form-actions">
            <button type="submit" class="btn" disabled={saving}>
              {#if saving}
                <div class="spinner-small"></div>
                Speichern...
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                Profil speichern
              {/if}
            </button>
          </div>

          {#if message}
            <div class="message" class:success={messageType === 'success'} class:error={messageType === 'error'}>
              {message}
            </div>
          {/if}
        </form>

        <!-- Error Log Sektion -->
        {#if errorLogExists}
          <div class="card errorlog-section">
            <h3 class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
              </svg>
              Fehlerprotokoll
            </h3>
            <p class="errorlog-info">Es liegen abgelehnte Uploads vor.</p>
            <div class="errorlog-actions">
              <button class="btn-secondary" on:click={downloadErrorLog}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                Fehlerlog herunterladen
              </button>
              <button class="btn-danger" on:click={deleteErrorLog}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                </svg>
                Fehlerlog löschen
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .profile-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    color: var(--accent-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
  }

  .back-btn:hover {
    background: var(--border-color);
    transform: translateY(-1px);
  }

  .page-title {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
    flex: 1;
  }

  .signout-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s ease;
    background: var(--error-color);
    color: white;
  }

  .signout-btn:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  .profile-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .avatar-section {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 2rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 2px 8px var(--shadow);
  }

  .avatar-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid var(--border-color);
    transition: all 0.2s ease;
  }

  .profile-avatar:hover {
    transform: scale(1.05);
  }

  .avatar-placeholder {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border: 4px solid var(--border-color);
    color: var(--text-muted);
  }

  .avatar-actions {
    display: flex;
    gap: 0.5rem;
  }

  .avatar-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .avatar-btn.primary {
    background: var(--accent-color);
    color: white;
  }

  .avatar-btn.primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }

  .avatar-btn.secondary {
    background: var(--error-color);
    color: white;
  }

  .avatar-btn.secondary:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  .user-info {
    flex: 1;
  }

  .user-name {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .user-email {
    margin: 0;
    color: var(--text-secondary);
  }

  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px var(--shadow);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  input[type="text"],
  input[type="tel"],
  input[type="url"],
  input[type="email"],
  textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.2s ease;
    outline: none;
    box-sizing: border-box;
  }

  input:focus,
  textarea:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  input.valid,
  textarea.valid {
    border-color: var(--success-color);
  }

  input.invalid,
  textarea.invalid {
    border-color: var(--error-color);
  }

  .error-text {
    font-size: 0.875rem;
    color: var(--error-color);
    margin-top: 0.25rem;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .toggle-label:hover {
    background: var(--bg-tertiary);
  }

  .toggle-label input[type="checkbox"] {
    display: none;
  }

  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--border-color);
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .toggle-label input:checked + .toggle-switch {
    background: var(--accent-color);
  }

  .toggle-label input:checked + .toggle-switch::after {
    transform: translateX(20px);
  }

  .toggle-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-actions {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 200px;
    justify-content: center;
  }

  .btn:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--shadow);
  }

  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .message {
    margin-top: 1.5rem;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    text-align: center;
  }

  .message.success {
    background: var(--success-color);
    color: white;
  }

  .message.error {
    background: var(--error-color);
    color: white;
  }

  .errorlog-section {
    border-color: var(--error-color);
  }

  .errorlog-info {
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
  }

  .errorlog-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: var(--border-color);
    transform: translateY(-1px);
  }

  .btn-danger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--error-color);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-danger:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  .hidden {
    display: none;
  }

  /* Accountname Styles */
  .accountname-input-group {
    display: flex;
    align-items: center;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-primary);
    transition: all 0.2s ease;
    position: relative;
  }

  .accountname-input-group:focus-within {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .url-prefix {
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 500;
    border-right: 1px solid var(--border-color);
    white-space: nowrap;
    font-size: 0.875rem;
  }

  .accountname-input-group input {
    border: none;
    background: transparent;
    padding: 0.75rem 1rem;
    flex: 1;
    font-size: 1rem;
    color: var(--text-primary);
    outline: none;
  }

  .accountname-input-group input::placeholder {
    color: var(--text-tertiary);
  }

  .checking-spinner {
    position: absolute;
    right: 12px;
    display: flex;
    align-items: center;
    color: var(--accent-color);
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  .help-text {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .success-text {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--success-color);
    font-weight: 500;
  }

  /* Privacy Settings Styles */
  .privacy-explanation {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 6px;
    border-left: 4px solid var(--accent-color);
  }

  .privacy-explanation .help-text {
    margin: 0;
    font-style: normal;
    line-height: 1.5;
  }

  .privacy-explanation strong {
    color: var(--text-primary);
  }

  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  select:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  select option {
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0.5rem;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .profile-container {
      padding: 1rem 0.5rem;
    }

    .avatar-section {
      flex-direction: column;
      text-align: center;
      gap: 1.5rem;
    }

    .profile-avatar,
    .avatar-placeholder {
      width: 100px;
      height: 100px;
    }

    .avatar-actions {
      justify-content: center;
    }

    .card {
      padding: 1.5rem;
    }

    .errorlog-actions {
      flex-direction: column;
    }

    .btn-secondary,
    .btn-danger {
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .profile-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .page-title {
      font-size: 1.5rem;
      order: -1;
    }

    .signout-btn {
      align-self: flex-end;
      margin-top: 0.5rem;
    }

    .card {
      padding: 1rem;
    }

    .btn {
      width: 100%;
      min-width: auto;
    }
  }
</style> 