<script lang="ts">
  import { sessionStore } from '../../lib/sessionStore';
  import { supabase } from '../../lib/supabaseClient';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let isLoggedIn = false;
  let loginEmail = '';
  let loginPassword = '';
  let loginLoading = false;
  let loginError = '';
  let loginInfo = '';
  let showRegister = false;

  $: isLoggedIn = $sessionStore.isAuthenticated;

  async function loginWithProvider(provider: 'google' | 'facebook') {
    loginLoading = true;
    loginError = '';
    
    // Session löschen vor OAuth-Login für direkten Login
    sessionStore.clearSession();
    console.log('🔓 Direct OAuth login - cleared session data');
    
    // Für Produktionsumgebung: Explizite Redirect-URL setzen
    const redirectTo = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? `${window.location.origin}/auth/callback`
      : undefined;
    
    const { error: authError } = await supabase.auth.signInWithOAuth({ 
      provider,
      options: {
        redirectTo
      }
    });
    
    if (authError) loginError = authError.message;
    loginLoading = false;
  }

  async function loginWithEmail() {
    loginLoading = true;
    loginError = '';
    const { error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (authError) {
      loginError = authError.message;
    } else {
      // Erfolgreicher Login - Session löschen für direkten Login
      sessionStore.clearSession();
      console.log('🔓 Direct login - cleared session data');
      
      loginEmail = '';
      loginPassword = '';
    }
    loginLoading = false;
  }

  async function signupWithEmail() {
    loginLoading = true;
    loginError = '';
    loginInfo = '';
    const { error: authError } = await supabase.auth.signUp({ email: loginEmail, password: loginPassword });
    if (authError) {
      loginError = authError.message;
    } else {
      // Erfolgreiche Registrierung - Session löschen für direkten Login
      sessionStore.clearSession();
      console.log('🔓 Direct signup - cleared session data');
      
      loginInfo = 'Bitte bestätige deine E-Mail-Adresse. Du kannst dich nach der Bestätigung anmelden.';
      loginEmail = '';
      loginPassword = '';
      showRegister = false;
    }
    loginLoading = false;
  }

  async function resetPassword() {
    if (!loginEmail) {
      loginError = 'Bitte gib deine E-Mail-Adresse ein.';
      return;
    }
    
    loginLoading = true;
    loginError = '';
    
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`
    });
    
    if (error) {
      loginError = error.message;
    } else {
      loginInfo = 'Passwort-Reset-Link wurde an deine E-Mail gesendet.';
      loginEmail = '';
    }
    
    loginLoading = false;
  }

  function setAnonymousMode() {
    sessionStore.setAnonymous(true);
    goto('/');
  }

  function onClose() {
    // Bei Login-Seite: zurück zur Startseite
    goto('/');
  }
</script>

{#if !isLoggedIn}
  <div class="modern-login-overlay">
    <div class="modern-login-content">
      <button class="modern-login-close" on:click={onClose}>×</button>
      <img src="/culoca-logo-512px.png" alt="Culoca Logo" class="modern-login-logo" />

      {#if loginError}
        <div class="modern-login-error">{loginError}</div>
      {/if}
      {#if loginInfo}
        <div class="modern-login-info">{loginInfo}</div>
      {/if}

      <div class="modern-social-login">
        <button class="modern-social-btn google-btn" on:click={() => loginWithProvider('google')} disabled={loginLoading}>
          <svg class="modern-social-icon" viewBox="0 0 48 48" fill="none">
            <g>
              <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C36.45 2.36 30.68 0 24 0 14.82 0 6.71 5.06 2.69 12.44l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/>
              <path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.03l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.5z"/>
              <path fill="#FBBC05" d="M9.67 28.64c-1.13-3.36-1.13-6.92 0-10.28l-7.98-6.2C-1.13 17.13-1.13 31.87 1.69 37.84l7.98-6.2z"/>
              <path fill="#EA4335" d="M24 46c6.48 0 11.92-2.14 15.9-5.82l-7.19-5.6c-2.01 1.35-4.6 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.94l-7.98 6.2C6.71 42.94 14.82 48 24 48z"/>
            </g>
          </svg>
        </button>
        <button class="modern-social-btn facebook-btn" on:click={() => loginWithProvider('facebook')} disabled={loginLoading}>
          <svg class="modern-social-icon" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="white"/>
            <path d="M20.5 16H18V24H15V16H13.5V13.5H15V12.25C15 10.73 15.67 9 18 9H20.5V11.5H19.25C18.84 11.5 18.5 11.84 18.5 12.25V13.5H20.5L20 16Z" fill="#23272F"/>
          </svg>
        </button>
      </div>

      <div class="modern-login-tabs">
        <button class="modern-tab-btn" class:active={!showRegister} on:click={() => showRegister = false}>
          Anmelden
        </button>
        <button class="modern-tab-btn" class:active={showRegister} on:click={() => showRegister = true}>
          Registrieren
        </button>
      </div>

      {#if !showRegister}
        <form class="modern-login-form" on:submit|preventDefault={loginWithEmail}>
          <input class="modern-login-input" type="email" placeholder="E-Mail" bind:value={loginEmail} required />
          <input class="modern-login-input" type="password" placeholder="Passwort" bind:value={loginPassword} required />
          <button class="modern-login-submit-btn" type="submit" disabled={loginLoading}>
            {loginLoading ? 'Anmelden...' : 'Anmelden'}
          </button>
          <button type="button" class="modern-forgot-password" on:click={resetPassword}>
            Passwort vergessen?
          </button>
        </form>
      {:else}
        <form class="modern-login-form" on:submit|preventDefault={signupWithEmail}>
          <input class="modern-login-input" type="email" placeholder="E-Mail" bind:value={loginEmail} required />
          <input class="modern-login-input" type="password" placeholder="Passwort" bind:value={loginPassword} required />
          <button class="modern-login-submit-btn" type="submit" disabled={loginLoading}>
            {loginLoading ? 'Registrieren...' : 'Registrieren'}
          </button>
        </form>
      {/if}

      <div class="modern-anonymous-section">
        <div class="modern-anonymous-divider">
          <span>oder</span>
        </div>
        <button class="modern-anonymous-btn" on:click={setAnonymousMode}>
          Anonym weiter
        </button>
        <p class="modern-anonymous-info">
          Anonyme Benutzer können die Galerie ansehen, aber keine Bilder hochladen.
        </p>
      </div>

      <div class="modern-login-footer">
        <div class="modern-footer-links">
          <a href="/impressum" class="modern-footer-link">Impressum</a>
          <span class="modern-footer-separator">•</span>
          <a href="/datenschutz" class="modern-footer-link">Datenschutz</a>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="min-h-screen flex items-center justify-center bg-[#0a1124]">
    <div class="text-center text-white">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
      <p>Du bist bereits angemeldet. Weiterleitung...</p>
    </div>
  </div>
{/if}

<style>
  /* Modern Login Overlay */
  .modern-login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #0a1124 0%, #1a202c 100%);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease-out;
  }
  .modern-login-content {
    background: rgba(26, 32, 44, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 2rem;
    text-align: center;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(238, 114, 33, 0.3);
    position: relative;
    overflow: hidden;
  }
  .modern-login-content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #ee7221, #ff8c42);
    border-radius: 24px 24px 0 0;
  }
  .modern-login-logo {
    width: 120px;
    height: 120px;
    margin: 0 auto 1rem;
    object-fit: contain;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
  }
  .modern-login-error {
    background: linear-gradient(135deg, #dc3545, #c82333);
    color: #fff;
    padding: 0.75rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  }
  .modern-login-info {
    background: linear-gradient(135deg, #28a745, #218838);
    color: #fff;
    padding: 0.75rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  }
  .modern-social-login {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }
  .modern-social-btn {
    background: #fff;
    border: 2px solid #f0f0f0;
    border-radius: 14px;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .modern-social-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    border-color: #ee7221;
  }
  .modern-social-btn:active {
    transform: translateY(0);
  }
  .modern-social-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .modern-social-icon {
    width: 28px;
    height: 28px;
  }
  .modern-login-tabs {
    display: flex;
    margin-bottom: 2rem;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  .modern-tab-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
  }
  .modern-tab-btn.active {
    background: linear-gradient(135deg, #ee7221, #ff8c42);
    color: #fff;
    box-shadow: 0 2px 8px rgba(238, 114, 33, 0.3);
  }
  .modern-tab-btn:not(.active):hover {
    background: rgba(238, 114, 33, 0.2);
    color: #ee7221;
  }
  .modern-login-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .modern-login-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.9);
    color: #2d3748;
    font-size: 0.95rem;
    box-sizing: border-box;
    transition: all 0.3s ease;
  }
  .modern-login-input::placeholder {
    color: #718096;
  }
  .modern-login-input:focus {
    outline: none;
    border-color: #ee7221;
    box-shadow: 0 0 0 4px rgba(238, 114, 33, 0.2);
    background: rgba(255, 255, 255, 0.95);
  }
  .modern-login-submit-btn {
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(135deg, #ee7221, #ff8c42);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(238, 114, 33, 0.3);
  }
  .modern-login-submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #d6610a, #ee7221);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(238, 114, 33, 0.4);
  }
  .modern-login-submit-btn:active {
    transform: translateY(0);
  }
  .modern-login-submit-btn:disabled {
    background: linear-gradient(135deg, #6c757d, #495057);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .modern-forgot-password {
    background: none;
    border: none;
    color: #ee7221;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.5rem 0;
    text-decoration: underline;
    transition: color 0.3s ease;
  }
  .modern-forgot-password:hover {
    color: #d6610a;
  }
  .modern-login-footer {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  .modern-footer-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  .modern-footer-link {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    transition: color 0.3s ease;
  }
  .modern-footer-link:hover {
    color: #ee7221;
  }
  .modern-footer-separator {
    color: rgba(255, 255, 255, 0.5);
    font-weight: bold;
  }
  /* Anonymous section styles */
  .modern-anonymous-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
  }
  .modern-anonymous-divider {
    text-align: center;
    margin-bottom: 1rem;
    position: relative;
  }
  .modern-anonymous-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.2);
  }
  .modern-anonymous-divider span {
    background: #1a1a1a;
    padding: 0 1rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    position: relative;
  }
  .modern-anonymous-btn {
    width: 100%;
    padding: 0.875rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 0.75rem;
  }
  .modern-anonymous-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
  }
  .modern-anonymous-info {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
    text-align: center;
    line-height: 1.4;
  }
  .modern-login-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.5rem;
    cursor: pointer;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.3s ease;
  }
  .modern-login-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @media (max-width: 600px) {
    .modern-login-content {
      padding: 1.5rem;
      margin: 1rem;
      border-radius: 20px;
    }
    .modern-login-logo {
      width: 160px;
      height: 160px;
      margin-bottom: 1rem;
    }
    .modern-social-btn {
      width: 56px;
      height: 56px;
    }
    .modern-social-icon {
      width: 28px;
      height: 28px;
    }
    .modern-login-input,
    .modern-login-submit-btn {
      padding: 0.875rem;
      font-size: 0.95rem;
    }
  }
</style> 