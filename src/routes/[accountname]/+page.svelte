<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import type { NewsFlashImage } from '$lib/types';
  import GalleryLayout from '$lib/GalleryLayout.svelte';
  import { sessionStore } from '$lib/sessionStore';
  import { filterStore } from '$lib/filterStore';
  
  let loading = true;
  let error = '';
  let profile: any = null;
  let images: NewsFlashImage[] = [];
  let accountname = '';
  
  onMount(async () => {
    accountname = $page.params.accountname;
    
    // Check if this is a reserved route
    const reservedRoutes = [
      'admin', 'api', 'auth', 'login', 'register', 'signup', 'profile', 
      'settings', 'upload', 'bulk-upload', 'debug', 'item', 'simulation',
      'uploads', 'app', 'www', 'mail', 'ftp', 'blog', 'news', 'help',
      'support', 'about', 'contact', 'privacy', 'terms', 'legal'
    ];
    
    if (reservedRoutes.includes(accountname.toLowerCase())) {
      error = 'Diese Route ist reserviert';
      loading = false;
      return;
    }
    
    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      const isLoggedIn = !!user;
      
      // Load profile by accountname
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('accountname', accountname.toLowerCase())
        .single();
        
      if (profileError || !profileData) {
              // If profile not found and user is not logged in, redirect to main page with return URL
      if (!isLoggedIn) {
        goto(`/?redirect=${encodeURIComponent($page.url.pathname)}`);
        return;
      }
        
        // If user is logged in but profile not found, create virtual referrer account
        // This handles cases like /tourismusverband where the account is for customer branding
        // but doesn't correspond to an actual user profile
        console.log(`Creating virtual referrer account for: ${accountname}`);
        
        // Create a virtual referrer account for customer branding
        const virtualReferrer = {
          profileId: `virtual-${accountname}`, // Virtual ID for non-existent profiles
          accountName: accountname,
          fullName: accountname.charAt(0).toUpperCase() + accountname.slice(1), // Capitalize first letter
          avatarUrl: undefined,
          privacyMode: 'public' as const, // Default to public mode for virtual accounts
          timestamp: Date.now()
        };
        
        // Store the virtual referrer account
        filterStore.setReferrerAccount(virtualReferrer);
        
        // Redirect to main app with customer branding enabled
        goto('/');
        return;
      }
      
      profile = profileData;
      
      // Store referrer account information for persistent customer branding
      let avatarUrl = profile.avatar_url;
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        avatarUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
      }

      // Create referrer account object for session storage
      const referrerAccount = {
        profileId: profile.id,
        accountName: profile.accountname,
        fullName: profile.full_name || profile.accountname,
        avatarUrl,
        privacyMode: profile.privacy_mode || 'public',
        timestamp: Date.now()
      };

      // Store in session (persistent customer branding)
      sessionStore.setCustomerBranding(referrerAccount);
      
      if (profile.privacy_mode === 'private') {
        // Private mode: Apply customer branding as active user filter
        sessionStore.applyCustomerBrandingAsFilter();
        console.log('Private mode - customer branding applied as active filter');
        goto('/');
        return;
      } else if (profile.privacy_mode === 'closed') {
        // Closed mode: Apply customer branding as active user filter (like private)
        sessionStore.applyCustomerBrandingAsFilter();
        console.log('Closed mode - customer branding applied as active filter');
        goto('/');
        return;
      } else {
        // Public/All mode: only set customer branding for display
        // Don't set user filter - let user login with their own account
        console.log('Public/All mode - customer branding enabled, user can login with personal account');
        goto('/');
        return;
      }
      
    } catch (err) {
      console.error('Error loading profile:', err);
      error = 'Fehler beim Laden des Profils';
    } finally {
      loading = false;
    }
  });
  
  function handleImageClick(image: NewsFlashImage) {
    // Navigate to item detail page with anchor parameter
    const url = new URL(`/item/${image.id}`, window.location.origin);
    url.searchParams.set('anchor', image.id);
    goto(url.toString());
  }
</script>

<svelte:head>
  {#if profile}
    <title>{profile.full_name || profile.accountname} - Culoca</title>
    <meta name="description" content="Bilder von {profile.full_name || profile.accountname} auf Culoca" />
  {/if}
</svelte:head>

<div class="profile-page">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Profil wird geladen...</p>
    </div>
  {:else if error}
    <div class="error">
      <h1>Fehler</h1>
      <p>{error}</p>
      <button on:click={() => goto('/')}>Zur Startseite</button>
    </div>
  {:else if profile}
    <div class="profile-header">
      <div class="profile-info">
        {#if profile.avatar_url}
          <img src={profile.avatar_url} alt={profile.full_name || profile.accountname} class="avatar" />
        {/if}
        <div class="profile-details">
          <h1>{profile.full_name || profile.accountname}</h1>
          {#if profile.full_name && profile.accountname}
            <p class="accountname">@{profile.accountname}</p>
          {/if}
          <p class="image-count">{images.length} Bilder</p>
        </div>
      </div>
      
      {#if profile.website || profile.instagram || profile.facebook || profile.twitter}
        <div class="social-links">
          {#if profile.website && profile.show_website}
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </a>
          {/if}
          {#if profile.instagram && profile.show_social}
            <a href={profile.instagram} target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
          {/if}
          {#if profile.facebook && profile.show_social}
            <a href={profile.facebook} target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
          {/if}
          {#if profile.twitter && profile.show_social}
            <a href={profile.twitter} target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
              </svg>
            </a>
          {/if}
        </div>
      {/if}
    </div>
    
    {#if images.length > 0}
             <div class="gallery-container">
         <GalleryLayout 
           items={images.map(img => ({
             src: img.path_512,
             width: 400,
             height: 300,
             id: img.id,
             lat: img.lat,
             lon: img.lon
           }))}
           layout="justified"
           targetRowHeight={300}
           gap={4}
           onImageClick={handleImageClick}
         />
       </div>
    {:else}
      <div class="no-images">
        <p>Noch keine Bilder vorhanden</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .profile-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 1rem;
    text-align: center;
  }
  
  .error button {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s ease;
  }
  
  .error button:hover {
    background: var(--accent-hover);
  }
  
  .profile-header {
    padding: 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .profile-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  
  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--border-color);
  }
  
  .profile-details h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 600;
  }
  
  .accountname {
    color: var(--text-secondary);
    margin: 0.25rem 0;
    font-size: 1.1rem;
  }
  
  .image-count {
    color: var(--text-secondary);
    margin: 0.25rem 0;
  }
  
  .social-links {
    display: flex;
    gap: 1rem;
  }
  
  .social-links a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    text-decoration: none;
    transition: all 0.2s ease;
  }
  
  .social-links a:hover {
    background: var(--accent-color);
    color: white;
    transform: translateY(-2px);
  }
  
  .gallery-container {
    padding: 2rem;
  }
  
  .no-images {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }
  
  @media (max-width: 768px) {
    .profile-header {
      padding: 1rem;
      flex-direction: column;
      align-items: flex-start;
    }
    
    .profile-info {
      flex-direction: column;
      text-align: center;
      align-items: center;
    }
    
    .avatar {
      width: 60px;
      height: 60px;
    }
    
    .profile-details h1 {
      font-size: 1.5rem;
    }
    
    .gallery-container {
      padding: 1rem;
    }
  }
</style> 