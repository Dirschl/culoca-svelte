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

  onMount(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      goto('/login');
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

  async function saveProfile() {
    saving = true;
    message = '';
    try {
      let avatarPath = profile?.avatar_url;
      if (avatarFile) {
        avatarPath = await uploadAvatar();
      }
      const profileData = {
        id: user.id,
        full_name: name,
        address,
        phone,
        website,
        instagram,
        facebook,
        twitter,
        show_address: show_address,
        show_phone: show_phone,
        show_website: show_website,
        show_social: show_social,
        avatar_url: avatarPath,
        updated_at: new Date().toISOString(),
        email,
        show_email
      };
      const { error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });
      if (error) throw error;
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
</script>

<svelte:head>
  <title>Mein Profil - Culoca</title>
</svelte:head>

{#if loading}
  <div class="profile-loading">
    <div class="spinner"></div>
    <span>Lade Profil...</span>
  </div>
{:else}
  <div class="page-container">
    <!-- Zurück zur Startseite Button -->
    <div class="back-button-container">
      <a href="/" class="back-home-btn" on:click={goHome}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Zurück zur Startseite
      </a>
    </div>

    <!-- Profil Card -->
    <div class="profile-card">
      <div class="profile-header">
        <div class="avatar-section">
          <div class="avatar-wrapper">
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
            <label for="avatar-input" class="avatar-upload-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
              {getAvatarUrl() ? 'Ändern' : 'Hochladen'}
            </label>
            <input 
              id="avatar-input" 
              type="file" 
              accept="image/*" 
              on:change={handleAvatarChange}
              class="hidden"
            />
            {#if getAvatarUrl()}
              <button type="button" class="remove-avatar-btn" on:click={() => {
                avatarFile = null;
                avatarPreview = null;
                profile.avatar_url = null;
              }}>
                Entfernen
              </button>
            {/if}
          </div>
        </div>
        
        <div class="profile-info">
          <h1 class="profile-title">Mein Profil</h1>
          <div class="profile-email">{user.email}</div>
        </div>
      </div>

      <form class="profile-form" on:submit|preventDefault={saveProfile}>
        <!-- Persönliche Informationen -->
        <div class="form-section">
          <h2 class="section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            Persönliche Informationen
          </h2>
          <div class="form-group">
            <label for="fullName">Vollständiger Name</label>
            <input id="fullName" type="text" bind:value={name} placeholder="Dein vollständiger Name" />
          </div>
        </div>

        <!-- Kontakt & Info -->
        <div class="form-section">
          <h2 class="section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Kontakt & Info
          </h2>
          <div class="form-group">
            <label for="address">Adresse</label>
            <textarea id="address" bind:value={address} placeholder="Deine Adresse" rows="2"></textarea>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={show_address} />
              <span class="checkmark"></span>
              Adresse öffentlich anzeigen
            </label>
          </div>
          <div class="form-group">
            <label for="phone">Telefonnummer</label>
            <input id="phone" type="tel" bind:value={phone} placeholder="Deine Telefonnummer" />
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={show_phone} />
              <span class="checkmark"></span>
              Telefonnummer öffentlich anzeigen
            </label>
          </div>
          <div class="form-group">
            <label for="email">E-Mail</label>
            <input id="email" type="email" bind:value={email} placeholder="Deine E-Mail-Adresse" />
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={show_email} />
              <span class="checkmark"></span>
              E-Mail öffentlich anzeigen
            </label>
          </div>
          <div class="form-group">
            <label for="website">Webseite</label>
            <input id="website" type="url" bind:value={website} placeholder="https://deine-website.de" />
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={show_website} />
              <span class="checkmark"></span>
              Webseite öffentlich anzeigen
            </label>
          </div>
        </div>

        <!-- Social Media -->
        <div class="form-section">
          <h2 class="section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/>
            </svg>
            Social Media
          </h2>
          <div class="form-group">
            <label for="facebook">Facebook</label>
            <input id="facebook" type="url" bind:value={facebook} placeholder="https://facebook.com/dein-profil" />
          </div>
          <div class="form-group">
            <label for="instagram">Instagram</label>
            <input id="instagram" type="url" bind:value={instagram} placeholder="https://instagram.com/dein-profil" />
          </div>
          <div class="form-group">
            <label for="twitter">Twitter/X</label>
            <input id="twitter" type="url" bind:value={twitter} placeholder="https://twitter.com/dein-profil" />
          </div>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={show_social} />
            <span class="checkmark"></span>
            Social Media Links öffentlich anzeigen
          </label>
        </div>

        <!-- Speichern Button -->
        <div class="form-actions">
          <button type="submit" class="save-btn" disabled={saving}>
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
    </div>

    <div class="profile-actions">
      <button on:click={goHome}>Zurück zur Hauptseite</button>
      {#if errorLogExists}
        <div class="errorlog-info">Es liegen abgelehnte Uploads vor.</div>
        <button on:click={downloadErrorLog}>Fehlerlog herunterladen</button>
        <button on:click={deleteErrorLog}>Fehlerlog löschen</button>
      {/if}
      <div class="debug-errorlog-files">
        <b>Debug: errorlogs im Storage:</b>
        <ul>
          {#each errorLogFiles as file}
            <li>{file}</li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
{/if}

<style>
  .profile-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    color: #ccc;
    gap: 1rem;
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #2d2d44;
    border-top: 3px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Page Container */
  .page-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  /* Back Button */
  .back-button-container {
    margin-bottom: 2rem;
  }

  .back-home-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #1a1a2e;
    color: #fff;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s ease;
    border: 2px solid #2d2d44;
  }

  .back-home-btn:hover {
    background: #23234a;
    border-color: #0066cc;
    transform: translateY(-1px);
  }

  /* Profile Card */
  .profile-card {
    background: #181828;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    padding: 2.5rem;
    color: #fff;
    border: 1px solid #2d2d44;
  }

  /* Profile Header */
  .profile-header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #2d2d44;
  }

  .avatar-section {
    flex-shrink: 0;
  }

  .avatar-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid #2d2d44;
    background: #222b45;
    transition: border-color 0.2s;
  }

  .profile-avatar:hover {
    border-color: #0066cc;
  }

  .avatar-placeholder {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: #2d2d44;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    border: 4px solid #2d2d44;
  }

  .avatar-upload-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #0066cc;
    color: #fff;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .avatar-upload-btn:hover {
    background: #0052a3;
  }

  .remove-avatar-btn {
    padding: 0.25rem 0.75rem;
    background: #dc3545;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .remove-avatar-btn:hover {
    background: #c82333;
  }

  .profile-info {
    flex: 1;
  }

  .profile-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #fff;
  }

  .profile-email {
    color: #aaa;
    font-size: 1.1rem;
  }

  /* Form Sections */
  .form-section {
    margin-bottom: 2.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.3rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 1.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #2d2d44;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  /* Form Inputs */
  input[type="text"],
  input[type="tel"],
  input[type="url"],
  input[type="email"],
  textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #2d2d44;
    border-radius: 8px;
    background: #23242a;
    color: #fff;
    font-size: 1rem;
    margin-bottom: 0.5rem;
    transition: all 0.2s ease;
    outline: none;
    box-sizing: border-box;
  }

  input[type="text"]:focus,
  input[type="tel"]:focus,
  input[type="url"]:focus,
  input[type="email"]:focus,
  textarea:focus {
    border-color: #0066cc;
    box-shadow: 0 0 0 3px #0066cc33;
    background: #232b3a;
  }

  label {
    font-size: 1rem;
    font-weight: 500;
    color: #fff;
    margin-bottom: 0.5rem;
    display: block;
  }

  /* Checkboxes */
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    color: #ccc;
    margin-top: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .checkbox-label:hover {
    background: #2d2d44;
  }

  .checkbox-label input[type="checkbox"] {
    accent-color: #0066cc;
    width: 1.2em;
    height: 1.2em;
    margin: 0;
  }

  /* Form Actions */
  .form-actions {
    display: flex;
    justify-content: center;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #2d2d44;
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: #0066cc;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 200px;
    justify-content: center;
  }

  .save-btn:hover:not(:disabled) {
    background: #0052a3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
  }

  .save-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff33;
    border-top: 2px solid #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Messages */
  .message {
    margin-top: 1.5rem;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    text-align: center;
  }

  .message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .hidden {
    display: none;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .page-container {
      padding: 1rem 0.5rem;
    }

    .profile-card {
      padding: 1.5rem;
    }

    .profile-header {
      flex-direction: column;
      gap: 1.5rem;
      text-align: center;
    }

    .profile-avatar,
    .avatar-placeholder {
      width: 100px;
      height: 100px;
    }

    .profile-title {
      font-size: 1.5rem;
    }

    .section-title {
      font-size: 1.1rem;
    }

    .save-btn {
      width: 100%;
      min-width: auto;
    }
  }

  @media (max-width: 480px) {
    .profile-card {
      padding: 1rem;
    }

    .profile-avatar,
    .avatar-placeholder {
      width: 80px;
      height: 80px;
    }

    .profile-title {
      font-size: 1.3rem;
    }

    .back-home-btn {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
    }
  }

  .profile-actions {
    margin-top: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .errorlog-info {
    color: #aaa;
    font-size: 0.9rem;
  }
</style> 