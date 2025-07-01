<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let email = '';
  let password = '';
  let errorMsg = '';
  let loading = false;

  async function loginWithProvider(provider: 'google' | 'facebook') {
    loading = true;
    errorMsg = '';
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) errorMsg = error.message;
    loading = false;
  }

  async function loginWithEmail() {
    loading = true;
    errorMsg = '';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorMsg = error.message;
    } else {
      goto('/settings');
    }
    loading = false;
  }

  async function signupWithEmail() {
    loading = true;
    errorMsg = '';
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      errorMsg = error.message;
    } else {
      goto('/settings');
    }
    loading = false;
  }

  // Nach Login per OAuth weiterleiten
  onMount(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) goto('/settings');
    });
  });
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-900">
  <div class="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mt-8">
    <h1 class="text-2xl font-bold mb-6 text-center">Anmelden</h1>

    {#if errorMsg}
      <div class="mb-4 text-red-600 text-center">{errorMsg}</div>
    {/if}

    <button class="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded mb-3 flex items-center justify-center gap-2" on:click={() => loginWithProvider('google')} disabled={loading}>
      <svg class="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C36.45 2.36 30.68 0 24 0 14.82 0 6.71 5.06 2.69 12.44l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.03l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.5z"/><path fill="#FBBC05" d="M9.67 28.64c-1.13-3.36-1.13-6.92 0-10.28l-7.98-6.2C-1.13 17.13-1.13 31.87 1.69 37.84l7.98-6.2z"/><path fill="#EA4335" d="M24 46c6.48 0 11.92-2.14 15.9-5.82l-7.19-5.6c-2.01 1.35-4.6 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.94l-7.98 6.2C6.71 42.94 14.82 48 24 48z"/></g></svg>
      Mit Google anmelden
    </button>
    <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-6 flex items-center justify-center gap-2" on:click={() => loginWithProvider('facebook')} disabled={loading}>
      <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.675 0h-21.35C.6 0 0 .6 0 1.326v21.348C0 23.4.6 24 1.326 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.797.143v3.24l-1.918.001c-1.504 0-1.797.715-1.797 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.4 24 24 23.4 24 22.674V1.326C24 .6 23.4 0 22.675 0"/></svg>
      Mit Facebook anmelden
    </button>

    <div class="mb-4 text-center text-gray-500">oder mit E-Mail</div>
    <input class="w-full border border-gray-300 rounded px-3 py-2 mb-2" type="email" placeholder="E-Mail" bind:value={email} required />
    <input class="w-full border border-gray-300 rounded px-3 py-2 mb-4" type="password" placeholder="Passwort" bind:value={password} required />
    <button class="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 px-4 rounded mb-2" on:click={loginWithEmail} disabled={loading}>Anmelden</button>
    <button class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded" on:click={signupWithEmail} disabled={loading}>Registrieren</button>
  </div>
</div> 