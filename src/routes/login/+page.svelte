<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { sessionStore } from '$lib/sessionStore';

  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  let info = '';
  let showRegister = false;
  let redirectUrl = '';

  async function loginWithProvider(provider: 'google' | 'facebook') {
    loading = true;
    error = '';
    
    // Session löschen vor OAuth-Login für direkten Login
    sessionStore.clearSession();
    console.log('🔓 Direct OAuth login from /login - cleared session data');
    
    // Für Produktionsumgebung: Explizite Redirect-URL setzen
    let redirectTo = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? `${window.location.origin}/auth/callback`
      : undefined;
    
    // Add redirect URL as query parameter if provided
    if (redirectTo && redirectUrl) {
      redirectTo += `?redirect=${encodeURIComponent(redirectUrl)}`;
    }
    
    const { error: authError } = await supabase.auth.signInWithOAuth({ 
      provider,
      options: {
        redirectTo
      }
    });
    
    if (authError) error = authError.message;
    loading = false;
  }

  async function loginWithEmail() {
    loading = true;
    error = '';
    
    // Session löschen vor Login für direkten Login
    sessionStore.clearSession();
    console.log('🔓 Direct email login from /login - cleared session data');
    
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      error = authError.message;
    } else {
      // Redirect to original URL if provided, otherwise to main page
      const targetUrl = redirectUrl || '/';
      goto(targetUrl);
    }
    loading = false;
  }

  async function signupWithEmail() {
    loading = true;
    error = '';
    info = '';
    
    // Session löschen vor Registrierung für direkten Login
    sessionStore.clearSession();
    console.log('🔓 Direct signup from /login - cleared session data');
    
    // Development mode: disable email confirmation
    const isDevelopment = window.location.hostname === 'localhost';
    
    const { error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // In development: skip email confirmation
        ...(isDevelopment && { data: { email_confirm: false } })
      }
    });
    
    if (authError) {
      error = authError.message;
    } else {
      if (isDevelopment) {
        info = 'Entwicklungsmodus: Konto erstellt. Du kannst dich direkt anmelden.';
      } else {
        info = 'Bitte bestätige deine E-Mail-Adresse. Du kannst dich nach der Bestätigung anmelden.';
      }
      email = '';
      password = '';
      showRegister = false;
    }
    loading = false;
  }

  // Nach Login per OAuth weiterleiten
  onMount(() => {
    // Get redirect URL from query parameters
    redirectUrl = $page.url.searchParams.get('redirect') || '';
    
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const targetUrl = redirectUrl || '/';
        goto(targetUrl);
      }
    });
    // Nach OAuth-Redirect: Wenn #access_token in der URL, leite hart zur Hauptseite weiter
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const targetUrl = redirectUrl || '/';
      window.location.href = targetUrl;
    }
  });
</script>

<svelte:head>
  <title>Anmelden - Culoca</title>
  <link rel="icon" type="image/png" href="/culoca-icon.png" />
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center bg-[#0a1124] md:fixed md:inset-0 md:z-50 md:bg-black/60 md:backdrop-blur"
>
  <div class="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-4 w-full max-w-md flex flex-col items-center">
    <img src="/culoca-logo-512px.png" alt="Culoca Logo" class="w-64 aspect-square object-contain mb-2 drop-shadow-lg" />

    {#if error}
      <div class="mb-4 text-red-400 text-center font-semibold">{error}</div>
    {/if}
    {#if info}
      <div class="mb-4 text-green-400 text-center font-semibold">{info}</div>
    {/if}

    <div class="flex gap-6 mb-8">
      <button class="bg-white rounded-full p-2 shadow hover:scale-105 transition flex items-center justify-center" on:click={() => loginWithProvider('google')} disabled={loading} aria-label="Mit Google anmelden">
        <svg class="w-8 h-8" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g>
            <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C36.45 2.36 30.68 0 24 0 14.82 0 6.71 5.06 2.69 12.44l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/>
            <path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.03l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.5z"/>
            <path fill="#FBBC05" d="M9.67 28.64c-1.13-3.36-1.13-6.92 0-10.28l-7.98-6.2C-1.13 17.13-1.13 31.87 1.69 37.84l7.98-6.2z"/>
            <path fill="#EA4335" d="M24 46c6.48 0 11.92-2.14 15.9-5.82l-7.19-5.6c-2.01 1.35-4.6 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.94l-7.98 6.2C6.71 42.94 14.82 48 24 48z"/>
          </g>
        </svg>
      </button>
      <button class="bg-white rounded-full p-2 shadow hover:scale-105 transition flex items-center justify-center" on:click={() => loginWithProvider('facebook')} disabled={loading} aria-label="Mit Facebook anmelden">
        <svg class="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="16" fill="white"/>
          <path d="M20.5 16H18V24H15V16H13.5V13.5H15V12.25C15 10.73 15.67 9 18 9H20.5V11.5H19.25C18.84 11.5 18.5 11.84 18.5 12.25V13.5H20.5L20 16Z" fill="#23272F"/>
        </svg>
      </button>
    </div>

    <div class="w-full flex justify-center mb-6">
      <button class="px-4 py-1 rounded-l bg-white/20 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-culoca-orange transition-colors duration-150" on:click={() => showRegister = false} class:bg-culoca-orange={!showRegister} class:text-white={!showRegister}>Anmelden</button>
      <button class="px-4 py-1 rounded-r bg-white/20 font-semibold focus:outline-none focus:ring-2 focus:ring-culoca-orange transition-colors duration-150" on:click={() => showRegister = true} class:bg-culoca-orange={showRegister} class:text-white={showRegister} class:text-culoca-orange={!showRegister}>Registrieren</button>
    </div>

    {#if !showRegister}
      <form class="w-full flex flex-col gap-4" on:submit|preventDefault={loginWithEmail}>
        <input class="w-full rounded px-3 py-2 bg-white/80 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-culoca-orange" type="email" placeholder="E-Mail" bind:value={email} required />
        <input class="w-full rounded px-3 py-2 bg-white/80 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-culoca-orange" type="password" placeholder="Passwort" bind:value={password} required />
        <button class="w-full bg-culoca-orange hover:bg-culoca-orange-dark text-white font-semibold py-2 px-4 rounded transition" type="submit" disabled={loading}>Anmelden</button>
      </form>
    {:else}
      <form class="w-full flex flex-col gap-4" on:submit|preventDefault={signupWithEmail}>
        <input class="w-full rounded px-3 py-2 bg-white/80 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-culoca-orange" type="email" placeholder="E-Mail" bind:value={email} required />
        <input class="w-full rounded px-3 py-2 bg-white/80 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-culoca-orange" type="password" placeholder="Passwort" bind:value={password} required />
        <button class="w-full bg-culoca-orange hover:bg-culoca-orange-dark text-white font-semibold py-2 px-4 rounded transition" type="submit" disabled={loading}>Registrieren</button>
      </form>
    {/if}
    <!-- Links and footer -->
    <div class="mt-8 text-center space-y-4">
      <!-- Legal links -->
      <div class="text-xs text-white/60 space-x-4">
        <a href="/" class="hover:text-white transition-colors">← Zur Hauptseite</a>
        <span>•</span>
        <a href="/impressum" class="hover:text-white transition-colors">Impressum</a>
        <span>•</span>
        <a href="/datenschutz" class="hover:text-white transition-colors">Datenschutz</a>
      </div>
      
      <!-- Register prompt -->
      {#if !showRegister}
        <div class="text-sm text-white/80">
          Noch kein Konto? <button class="underline text-culoca-orange hover:text-white transition-colors" on:click={() => showRegister = true}>Registrieren</button>
        </div>
      {:else}
        <div class="text-sm text-white/80">
          Bereits ein Konto? <button class="underline text-culoca-orange hover:text-white transition-colors" on:click={() => showRegister = false}>Anmelden</button>
        </div>
      {/if}
    </div>
  </div>
</div> 