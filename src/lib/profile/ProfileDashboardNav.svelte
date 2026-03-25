<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProfileSection } from './profileSection';

	export let active: ProfileSection;
	export let showErrorLog = false;

	const dispatch = createEventDispatcher<{ select: ProfileSection }>();

	function select(section: ProfileSection) {
		dispatch('select', section);
	}
</script>

<nav class="dashboard-menu" aria-label="Profil Navigation">
	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'basics'}
		on:click={() => select('basics')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
				/>
			</svg>
			<span>Profil &amp; Konto</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'attribution'}
		on:click={() => select('attribution')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M12 2l3 7h7l-5.5 4.1L18 22l-6-4-6 4 1.5-8.9L2 9h7l3-7z" />
			</svg>
			<span>Attribution &amp; Rechte</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'privacy'}
		on:click={() => select('privacy')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
			</svg>
			<span>Privatsphäre</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'gps'}
		on:click={() => select('gps')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
				/>
			</svg>
			<span>GPS &amp; Home Base</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'contact'}
		on:click={() => select('contact')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
				/>
			</svg>
			<span>Kontakt</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'social'}
		on:click={() => select('social')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"
				/>
			</svg>
			<span>Social Media</span>
		</span>
	</button>

	<a
		class="dashboard-menu__link dashboard-menu__link--external"
		href="/dashboard?section=shares"
		data-sveltekit-preload-data="hover"
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<rect x="3" y="5" width="18" height="14" rx="2" />
				<path d="M8 12h8M12 8v8" />
			</svg>
			<span>Freigaben</span>
		</span>
		<strong class="dashboard-menu__external-hint">Dashboard</strong>
	</a>

	{#if showErrorLog}
		<button
			type="button"
			class="dashboard-menu__link"
			class:is-active={active === 'errorlog'}
			on:click={() => select('errorlog')}
		>
			<span class="dashboard-menu__label">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
				</svg>
				<span>Fehlerprotokoll</span>
			</span>
		</button>
	{/if}
</nav>

<style>
	.dashboard-menu {
		display: grid;
		gap: 0.55rem;
	}

	.dashboard-menu__link {
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		border-radius: 12px;
		padding: 0.7rem 0.8rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		cursor: pointer;
		font: inherit;
		text-align: left;
		width: 100%;
		box-sizing: border-box;
	}

	.dashboard-menu__label {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.dashboard-menu__link strong {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.dashboard-menu__link.is-active {
		border-color: color-mix(in srgb, var(--culoca-orange) 45%, var(--border-color) 55%);
		background: color-mix(in srgb, var(--culoca-orange) 10%, var(--bg-primary) 90%);
	}

	.dashboard-menu__link--external {
		text-decoration: none;
		color: inherit;
		cursor: pointer;
	}

	.dashboard-menu__external-hint {
		color: var(--text-secondary);
		font-size: 0.78rem;
		font-weight: 600;
	}
</style>
