<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { hasAdminPermission } from '$lib/sessionStore';

  let mobileOpen = false;
  let openDropdown: string | null = null;

  const navLinks = [
    { href: '/foto', label: 'Fotos' },
    { href: '/event', label: 'Events' },
    { href: '/firma', label: 'Firmen' },
    { href: '/galerie', label: 'Galerie' },
  ];

  const infoLinks = [
    { href: '/web', label: 'System' },
    { href: '/web/license', label: 'Lizenz' },
    { href: '/web/impressum', label: 'Impressum' },
    { href: '/web/datenschutz', label: 'Datenschutz' },
  ];

  const adminLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/roles', label: 'Rollen' },
    { href: '/admin/users', label: 'Benutzer' },
    { href: '/admin/items', label: 'Items' },
    { href: '/admin/analytics', label: 'Analytics' },
  ];

  $: currentPath = $page.url.pathname;

  function isActive(href: string): boolean {
    if (href === '/') return currentPath === '/';
    return currentPath === href || currentPath.startsWith(href + '/');
  }

  function isDropdownActive(links: { href: string }[]): boolean {
    return links.some((l) => isActive(l.href));
  }

  function toggleDropdown(id: string) {
    openDropdown = openDropdown === id ? null : id;
  }

  function closeMobile() {
    mobileOpen = false;
    openDropdown = null;
  }

  function closeDropdowns() {
    openDropdown = null;
  }

  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest('.dropdown')) {
        closeDropdowns();
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });
</script>

<nav class="site-nav" aria-label="Hauptnavigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Culoca Startseite">
      <svg class="logo-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 473.74 100.88" aria-hidden="true">
        <defs><style>.sn1{fill:var(--text-primary,#fff)}.sn2{fill:#ee7221}</style></defs>
        <path class="sn1" d="m0,41.35c0-6.3,1.12-11.99,3.35-17.07,2.24-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
        <path class="sn1" d="m114.95,82.71c-5.03,0-9.58-.63-13.66-1.89-4.07-1.26-7.55-3.15-10.42-5.67-2.88-2.52-5.09-5.71-6.65-9.57s-2.34-8.39-2.34-13.59V1.89h25.52v49.04c0,2.76.58,4.87,1.74,6.32,1.16,1.46,3.09,2.19,5.81,2.19s4.65-.73,5.81-2.19c1.16-1.46,1.74-3.56,1.74-6.32V1.89h25.64v50.1c0,5.2-.78,9.73-2.34,13.59s-3.79,7.05-6.71,9.57c-2.92,2.52-6.41,4.41-10.48,5.67-4.07,1.26-8.63,1.89-13.66,1.89Z"/>
        <path class="sn1" d="m165.07,1.89h26.6v58.13h22.04v20.68h-48.64V1.89Z"/>
        <path class="sn2" d="m221.15,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07Zm25.16,0c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
        <path class="sn1" d="m315.86,41.35c0-6.3,1.12-11.99,3.36-17.07,2.23-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
        <path class="sn1" d="m424.26,1.89h19.17l30.31,78.81h-25.16l-2.64-7.09h-24.2l-2.64,7.09h-25.16L424.26,1.89Zm14.97,54.35l-5.39-13.83-5.39,13.83h10.78Z"/>
      </svg>
    </a>

    <div class="nav-links" class:open={mobileOpen}>
      {#each navLinks as link}
        <a href={link.href} class="nav-link" class:active={isActive(link.href)} on:click={closeMobile}>{link.label}</a>
      {/each}

      <!-- Info dropdown (desktop) / expanded list (mobile) -->
      <div class="dropdown desktop-only">
        <button
          class="nav-link dropdown-toggle"
          class:active={isDropdownActive(infoLinks)}
          on:click|stopPropagation={() => toggleDropdown('info')}
        >
          Info
          <svg class="dd-arrow" class:dd-open={openDropdown === 'info'} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </button>
        {#if openDropdown === 'info'}
          <div class="dropdown-menu">
            {#each infoLinks as link}
              <a href={link.href} class="dropdown-item" class:active={isActive(link.href)} on:click={closeDropdowns}>{link.label}</a>
            {/each}
          </div>
        {/if}
      </div>
      <!-- Info links inline for mobile -->
      <div class="mobile-only nav-group">
        <span class="nav-group-label">Info</span>
        {#each infoLinks as link}
          <a href={link.href} class="nav-link nav-link--sub" class:active={isActive(link.href)} on:click={closeMobile}>{link.label}</a>
        {/each}
      </div>

      <!-- Admin dropdown (permission-gated) -->
      {#if $hasAdminPermission}
        <div class="dropdown desktop-only">
          <button
            class="nav-link dropdown-toggle"
            class:active={isDropdownActive(adminLinks)}
            on:click|stopPropagation={() => toggleDropdown('admin')}
          >
            Admin
            <svg class="dd-arrow" class:dd-open={openDropdown === 'admin'} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
          </button>
          {#if openDropdown === 'admin'}
            <div class="dropdown-menu">
              {#each adminLinks as link}
                <a href={link.href} class="dropdown-item" class:active={isActive(link.href)} on:click={closeDropdowns}>{link.label}</a>
              {/each}
            </div>
          {/if}
        </div>
        <div class="mobile-only nav-group">
          <span class="nav-group-label">Admin</span>
          {#each adminLinks as link}
            <a href={link.href} class="nav-link nav-link--sub" class:active={isActive(link.href)} on:click={closeMobile}>{link.label}</a>
          {/each}
        </div>
      {/if}
    </div>

    <button
      class="nav-burger"
      aria-label={mobileOpen ? 'Menü schließen' : 'Menü öffnen'}
      aria-expanded={mobileOpen}
      on:click={() => mobileOpen = !mobileOpen}
    >
      <span class="burger-line" class:open={mobileOpen}></span>
      <span class="burger-line" class:open={mobileOpen}></span>
      <span class="burger-line" class:open={mobileOpen}></span>
    </button>
  </div>

  {#if mobileOpen}
    <button class="nav-backdrop" on:click={closeMobile} aria-hidden="true" tabindex="-1"></button>
  {/if}
</nav>

<style>
  .site-nav {
    position: sticky;
    top: 0;
    z-index: 200;
    background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border-bottom: 1px solid var(--border-color);
  }

  .nav-inner {
    padding: 0 2rem;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  /* Logo */
  .nav-logo {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  .logo-svg { height: 34px; width: auto; }

  /* Links */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .nav-link {
    position: relative;
    padding: 0.5rem 0.85rem;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: 8px;
    transition: color 0.15s, background 0.15s;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
  }
  .nav-link:hover { color: var(--text-primary); background: var(--bg-tertiary); }
  .nav-link.active { color: var(--culoca-orange); }
  .nav-link.active::after {
    content: '';
    position: absolute;
    bottom: 2px; left: 0.85rem; right: 0.85rem;
    height: 2px; border-radius: 1px;
    background: var(--culoca-orange);
  }

  /* Dropdown */
  .dropdown { position: relative; }
  .dropdown-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .dd-arrow { transition: transform 0.2s; flex-shrink: 0; }
  .dd-open { transform: rotate(180deg); }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 170px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.14);
    z-index: 300;
    overflow: hidden;
  }
  .dropdown-item {
    display: block;
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: background 0.12s, color 0.12s;
  }
  .dropdown-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  .dropdown-item.active { color: var(--culoca-orange); }

  /* Mobile helpers */
  .mobile-only { display: none; }
  .nav-group-label {
    display: block;
    padding: 0.6rem 1rem 0.2rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .nav-link--sub { padding-left: 1.5rem; }

  /* Hamburger */
  .nav-burger {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 36px; height: 36px; padding: 6px;
    background: none; border: none; cursor: pointer;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .nav-burger:hover { background: var(--bg-tertiary); }
  .burger-line {
    display: block; width: 100%; height: 2px;
    background: var(--text-primary); border-radius: 1px;
    transition: transform 0.25s, opacity 0.25s;
    transform-origin: center;
  }
  .burger-line.open:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .burger-line.open:nth-child(2) { opacity: 0; }
  .burger-line.open:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  .nav-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    border: none; cursor: default; z-index: -1;
  }

  /* Mobile */
  @media (max-width: 720px) {
    .nav-inner { padding: 0 1.25rem; height: 54px; }
    .nav-burger { display: flex; }
    .desktop-only { display: none !important; }
    .mobile-only { display: block; }

    .nav-links {
      position: fixed;
      top: 54px; right: 0;
      width: 280px;
      max-height: calc(100dvh - 54px);
      flex-direction: column;
      align-items: stretch;
      gap: 0; padding: 0.75rem;
      background: var(--bg-primary);
      border-left: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      border-radius: 0 0 0 16px;
      box-shadow: -4px 8px 32px rgba(0,0,0,0.18);
      transform: translateX(100%);
      opacity: 0; pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
      overflow-y: auto;
    }
    .nav-links.open { transform: translateX(0); opacity: 1; pointer-events: auto; }
    .nav-link { padding: 0.75rem 1rem; font-size: 1rem; border-radius: 10px; }
    .nav-link.active::after { display: none; }
    .nav-link.active { background: var(--bg-tertiary); }
    .nav-link--sub { padding-left: 2rem; font-size: 0.925rem; }
    .nav-backdrop { display: block; }
  }
</style>
