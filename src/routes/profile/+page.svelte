<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

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
  <div class="profile-container">
    <form class="profile-form" on:submit|preventDefault={saveProfile}>
      <div class="profile-header">
        <div class="avatar-wrapper">
          {#if getAvatarUrl()}
            <img src={getAvatarUrl()} alt="Profilbild" class="avatar" />
          {:else}
            <div class="avatar-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="8" r="4"/>
                <path d="M2 20c0-4 8-6 10-6s10 2 10 6"/>
              </svg>
            </div>
          {/if}
          <label for="avatar-input" class="avatar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            {getAvatarUrl() ? 'Bild ändern' : 'Bild hochladen'}
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
        <div class="profile-main">
          <label for="fullName">Vollständiger Name</label>
          <input id="fullName" type="text" bind:value={name} placeholder="Dein vollständiger Name" />
          <div class="profile-meta">
            <span class="profile-email">{user.email}</span>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <h2>Kontakt & Info</h2>
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

      <div class="profile-section">
        <h2>Social Media</h2>
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

      <div class="profile-actions">
        <button type="submit" class="edit-btn" disabled={saving}>
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
  .profile-container {
    max-width: 600px;
    margin: 2rem auto;
    background: #181a20;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    padding: 2rem 1.5rem 1.5rem 1.5rem;
    color: #fff;
  }
  .profile-header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 2rem;
  }
  .avatar-wrapper {
    flex-shrink: 0;
  }
  .avatar {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #2d2d44;
    background: #222b45;
  }
  .avatar-placeholder {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: #2d2d44;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    border: 3px solid #2d2d44;
  }
  .profile-main {
    flex: 1;
  }
  .profile-name {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #fff;
  }
  .profile-meta {
    color: #aaa;
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }
  .profile-section {
    margin-bottom: 1.5rem;
  }
  .profile-section h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.75rem;
  }
  .profile-list {
    list-style: none;
    padding: 0;
    margin: 0;
    color: #eee;
    font-size: 1rem;
  }
  .profile-list li {
    margin-bottom: 0.5rem;
    word-break: break-all;
  }
  .profile-list a {
    color: #4fa3ff;
    text-decoration: underline;
    transition: color 0.2s;
  }
  .profile-list a:hover {
    color: #0066cc;
  }
  .private {
    color: #ffb300;
    font-size: 0.95em;
    margin-left: 0.5em;
    font-style: italic;
  }
  .profile-gallery-layout {
    font-size: 1.1rem;
    color: #fff;
    margin-top: 0.5rem;
  }
  .profile-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 2rem;
  }
  .edit-btn {
    background: #0066cc;
    color: #fff;
    padding: 0.7rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    text-decoration: none;
    font-size: 1rem;
    transition: background 0.2s;
  }
  .edit-btn:hover {
    background: #0052a3;
  }
  @media (max-width: 600px) {
    .profile-container {
      padding: 1rem 0.5rem;
    }
    .profile-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }
    .avatar, .avatar-placeholder {
      width: 72px;
      height: 72px;
    }
    .profile-name {
      font-size: 1.2rem;
    }
    .profile-section h2 {
      font-size: 1rem;
    }
    .profile-gallery-layout {
      font-size: 1rem;
    }
  }
  input[type="text"],
  input[type="tel"],
  input[type="url"],
  textarea {
    width: 100%;
    padding: 0.6rem 0.9rem;
    border: 1.5px solid #2d2d44;
    border-radius: 6px;
    background: #23242a;
    color: #fff;
    font-size: 1rem;
    margin-bottom: 0.5rem;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
    box-sizing: border-box;
  }
  input[type="text"]:focus,
  input[type="tel"]:focus,
  input[type="url"]:focus,
  textarea:focus {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px #0066cc33;
    background: #232b3a;
  }
  label {
    font-size: 1rem;
    font-weight: 500;
    color: #fff;
    margin-bottom: 0.2rem;
    display: block;
  }
  .form-group {
    margin-bottom: 1.2rem;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.98rem;
    color: #ccc;
    margin-top: 0.2rem;
    margin-bottom: 0.2rem;
    cursor: pointer;
  }
  .checkbox-label input[type="checkbox"] {
    accent-color: #0066cc;
    width: 1.1em;
    height: 1.1em;
    margin: 0 0.3em 0 0;
  }
</style> 