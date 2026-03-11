<script lang="ts">
  import { sessionStore } from '../../lib/sessionStore';
  import { supabase } from '../../lib/supabaseClient';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import SiteNav from '$lib/SiteNav.svelte';

  let isLoggedIn = false;
  let loginEmail = '';
  let loginPassword = '';
  let loginLoading = false;
  let loginError = '';
  let loginInfo = '';
  let showRegister = false;

  const loginBenefits = [
    'Eigene Objekte und Einträge anlegen',
    'Bilder hochladen und Inhalte bearbeiten',
    'Profil, Freigaben und Einstellungen vollständig nutzen'
  ];

  const oauthDetails = [
    {
      title: 'Was OAuth bedeutet',
      text: 'OAuth ist ein Anmeldeverfahren, bei dem du dich mit einem bestehenden Konto wie Google oder Facebook einloggst, ohne für Culoca ein separates Passwort pflegen zu müssen.'
    },
    {
      title: 'Welche Daten übernommen werden',
      text: 'Je nach Anbieter werden Name, E-Mail-Adresse und häufig auch dein Profilbild übernommen. Diese Angaben können in Culoca direkt als Profilbasis verwendet werden.'
    },
    {
      title: 'Warum das praktisch ist',
      text: 'Dein Profil ist schneller eingerichtet, du musst weniger manuell ausfüllen und kannst sofort mit Uploads, Einträgen und der Verwaltung deiner Inhalte starten.'
    }
  ];

  $: isLoggedIn = $sessionStore.isAuthenticated;

  onMount(() => {
    if (isLoggedIn) {
      goto('/');
    }
  });

  async function loginWithProvider(provider: 'google' | 'facebook') {
    loginLoading = true;
    loginError = '';
    loginInfo = '';

    sessionStore.clearSession();

    const redirectTo = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `${window.location.origin}/auth/callback`
      : undefined;

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });

    if (authError) loginError = authError.message;
    loginLoading = false;
  }

  async function loginWithEmail() {
    loginLoading = true;
    loginError = '';
    loginInfo = '';

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword
    });

    if (authError) {
      loginError = authError.message;
    } else if (data.user) {
      sessionStore.setUser(data.user.id, true);
      loginEmail = '';
      loginPassword = '';
      goto('/');
    }

    loginLoading = false;
  }

  async function signupWithEmail() {
    loginLoading = true;
    loginError = '';
    loginInfo = '';

    const { data, error: authError } = await supabase.auth.signUp({
      email: loginEmail,
      password: loginPassword
    });

    if (authError) {
      loginError = authError.message;
    } else if (data.user && data.session) {
      sessionStore.setUser(data.user.id, true);
      loginInfo = 'Registrierung erfolgreich. Du wirst automatisch angemeldet.';
      loginEmail = '';
      loginPassword = '';
      showRegister = false;
      setTimeout(() => goto('/'), 1200);
    } else {
      sessionStore.clearSession();
      loginInfo = 'Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse und melde dich danach an.';
      loginEmail = '';
      loginPassword = '';
      showRegister = false;
    }

    loginLoading = false;
  }

  async function resetPassword() {
    if (!loginEmail) {
      loginError = 'Bitte gib zuerst deine E-Mail-Adresse ein.';
      return;
    }

    loginLoading = true;
    loginError = '';
    loginInfo = '';

    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`
    });

    if (error) {
      loginError = error.message;
    } else {
      loginInfo = 'Ein Link zum Zurücksetzen wurde an deine E-Mail-Adresse gesendet.';
    }

    loginLoading = false;
  }

  function setAnonymousMode() {
    sessionStore.setAnonymous(true);
    goto('/');
  }
</script>

<svelte:head>
  <title>Login - Culoca</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !isLoggedIn}
  <div class="login-page">
    <SiteNav />

    <main class="login-main">
      <section class="login-shell">
        <div class="login-card surface-responsive surface-responsive--panel">
          <div class="login-header">
            <span class="eyebrow">Login</span>
            <h1>Culoca vollständig nutzen</h1>
            <p>
              Melde dich an, um eigene Objekte anzulegen, Uploads zu starten und dein Profil mit Rechten, Einstellungen und Inhalten zu verwalten.
            </p>
          </div>

          <div class="benefit-list">
            {#each loginBenefits as benefit}
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <span>{benefit}</span>
              </div>
            {/each}
          </div>

          {#if loginError}
            <div class="notice notice-error">{loginError}</div>
          {/if}

          {#if loginInfo}
            <div class="notice notice-info">{loginInfo}</div>
          {/if}

          <div class="oauth-row">
            <button class="oauth-btn" on:click={() => loginWithProvider('google')} disabled={loginLoading}>
              <span class="oauth-icon oauth-icon--google">G</span>
              <span>Mit Google anmelden</span>
            </button>
            <button class="oauth-btn" on:click={() => loginWithProvider('facebook')} disabled={loginLoading}>
              <span class="oauth-icon oauth-icon--facebook">f</span>
              <span>Mit Facebook anmelden</span>
            </button>
          </div>

          <div class="tab-row">
            <button class:active={!showRegister} class="tab-btn" on:click={() => showRegister = false}>Anmelden</button>
            <button class:active={showRegister} class="tab-btn" on:click={() => showRegister = true}>Registrieren</button>
          </div>

          {#if !showRegister}
            <form class="auth-form" on:submit|preventDefault={loginWithEmail}>
              <label class="field">
                <span>E-Mail</span>
                <input type="email" bind:value={loginEmail} placeholder="name@beispiel.de" required />
              </label>
              <label class="field">
                <span>Passwort</span>
                <input type="password" bind:value={loginPassword} placeholder="Passwort" required />
              </label>
              <button class="primary-btn" type="submit" disabled={loginLoading}>
                {loginLoading ? 'Anmelden…' : 'Anmelden'}
              </button>
              <button type="button" class="link-btn" on:click={resetPassword}>Passwort vergessen?</button>
            </form>
          {:else}
            <form class="auth-form" on:submit|preventDefault={signupWithEmail}>
              <label class="field">
                <span>E-Mail</span>
                <input type="email" bind:value={loginEmail} placeholder="name@beispiel.de" required />
              </label>
              <label class="field">
                <span>Passwort</span>
                <input type="password" bind:value={loginPassword} placeholder="Mindestens ein sicheres Passwort" required />
              </label>
              <button class="primary-btn" type="submit" disabled={loginLoading}>
                {loginLoading ? 'Registrieren…' : 'Registrieren'}
              </button>
            </form>
          {/if}

          <div class="guest-box">
            <div class="guest-divider"><span>oder</span></div>
            <button class="secondary-btn" on:click={setAnonymousMode}>Anonym weiter</button>
            <p>Ohne Login kannst du Inhalte ansehen, aber keine eigenen Objekte anlegen oder Uploads starten.</p>
          </div>
        </div>

        <aside class="info-card surface-responsive surface-responsive--panel">
          <h2>OAuth einfach erklärt</h2>
          <div class="info-list">
            {#each oauthDetails as item}
              <article class="info-item">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            {/each}
          </div>

          <div class="info-highlight">
            <h3>Welche Angaben typischerweise vorbefüllt werden</h3>
            <p>Name, E-Mail-Adresse und je nach Anbieter dein Profilbild. Danach kannst du die Angaben in deinem Culoca-Profil jederzeit ergänzen oder anpassen.</p>
          </div>
        </aside>
      </section>
    </main>
  </div>
{:else}
  <div class="login-redirect">
    <div class="login-redirect-card surface-responsive surface-responsive--panel">
      <div class="spinner"></div>
      <p>Du bist bereits angemeldet. Weiterleitung…</p>
    </div>
  </div>
{/if}

<style>
  .login-page {
    min-height: 100vh;
    background:
      radial-gradient(circle at top right, rgba(238, 114, 33, 0.14), transparent 28%),
      linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 94%, #0d1724 6%) 0%, var(--bg-primary) 30rem);
    color: var(--text-primary);
  }

  .login-main {
    padding: 2rem;
  }

  .login-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
    gap: 2rem;
    align-items: start;
  }

  .login-header h1 {
    margin: 0.85rem 0 0.9rem;
    font-size: clamp(2.2rem, 4vw, 3.5rem);
    line-height: 1.02;
    letter-spacing: -0.04em;
    max-width: 11ch;
  }

  .login-header p,
  .info-item p,
  .info-highlight p,
  .guest-box p {
    margin: 0;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .eyebrow {
    display: inline-flex;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    background: rgba(238, 114, 33, 0.14);
    color: var(--culoca-orange);
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .benefit-list,
  .info-list {
    display: grid;
    gap: 0.85rem;
    margin-top: 1.5rem;
  }

  .benefit-item,
  .info-item,
  .info-highlight {
    padding: 1rem 1.1rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .benefit-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 600;
  }

  .benefit-check {
    display: inline-flex;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 999px;
    align-items: center;
    justify-content: center;
    background: rgba(238, 114, 33, 0.16);
    color: var(--culoca-orange);
    flex-shrink: 0;
  }

  .notice {
    margin-top: 1.25rem;
    padding: 0.9rem 1rem;
    border-radius: 16px;
    border: 1px solid transparent;
  }

  .notice-error {
    background: color-mix(in srgb, #f8d7da 24%, transparent);
    color: #ffd3d6;
    border-color: rgba(245, 198, 203, 0.35);
  }

  .notice-info {
    background: color-mix(in srgb, #d4edda 28%, transparent);
    color: #c9ffd6;
    border-color: rgba(149, 214, 168, 0.35);
  }

  .oauth-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
    margin-top: 1.5rem;
  }

  .oauth-btn,
  .primary-btn,
  .secondary-btn,
  .tab-btn,
  .link-btn {
    font: inherit;
  }

  .oauth-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
    min-height: 3.35rem;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, white 10%);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
    cursor: pointer;
  }

  .oauth-icon {
    display: inline-flex;
    width: 1.9rem;
    height: 1.9rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-weight: 800;
    background: white;
  }

  .oauth-icon--google {
    color: #4285f4;
  }

  .oauth-icon--facebook {
    color: #1877f2;
  }

  .tab-row {
    display: inline-grid;
    grid-template-columns: repeat(2, 1fr);
    margin-top: 1.5rem;
    padding: 0.25rem;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
  }

  .tab-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    padding: 0.75rem 1.2rem;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
  }

  .tab-btn.active {
    background: rgba(238, 114, 33, 0.14);
    color: var(--text-primary);
  }

  .auth-form {
    display: grid;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .field {
    display: grid;
    gap: 0.45rem;
  }

  .field span {
    font-weight: 600;
  }

  .field input {
    min-height: 3.25rem;
    border-radius: 14px;
    padding: 0.85rem 1rem;
  }

  .primary-btn,
  .secondary-btn {
    min-height: 3.3rem;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    font-weight: 700;
  }

  .primary-btn {
    background: linear-gradient(135deg, var(--culoca-orange) 0%, #f39c4c 100%);
    color: white;
  }

  .secondary-btn {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, white 10%);
  }

  .link-btn {
    justify-self: start;
    border: none;
    background: transparent;
    color: var(--culoca-orange);
    padding: 0;
    cursor: pointer;
    font-weight: 600;
  }

  .guest-box {
    margin-top: 1.75rem;
  }

  .guest-divider {
    position: relative;
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .guest-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    border-top: 1px solid color-mix(in srgb, var(--border-color) 80%, white 10%);
  }

  .guest-divider span {
    position: relative;
    padding: 0 0.8rem;
    background: var(--bg-secondary);
    color: var(--text-muted);
  }

  .info-card h2 {
    margin: 0 0 1rem;
    font-size: 1.5rem;
  }

  .info-item h3,
  .info-highlight h3 {
    margin: 0 0 0.45rem;
    font-size: 1rem;
  }

  .login-redirect {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  .login-redirect-card {
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 980px) {
    .login-shell {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .login-main {
      padding: 1rem;
    }

    .oauth-row {
      grid-template-columns: 1fr;
    }

    .login-header h1 {
      max-width: none;
      font-size: clamp(2rem, 12vw, 2.8rem);
    }
  }
</style>
