<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SettingsSection } from './settingsSection';

	export let active: SettingsSection;

	const dispatch = createEventDispatcher<{ select: SettingsSection }>();

	function select(section: SettingsSection) {
		dispatch('select', section);
	}
</script>

<nav class="dashboard-menu" aria-label="Einstellungen Navigation">
	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'appearance'}
		on:click={() => select('appearance')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3.5-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
				/>
			</svg>
			<span>Erscheinungsbild</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'gallery'}
		on:click={() => select('gallery')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"
				/>
			</svg>
			<span>Galerie &amp; Standort</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'audio'}
		on:click={() => select('audio')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
				/>
			</svg>
			<span>Audio</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'interface'}
		on:click={() => select('interface')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"
				/>
			</svg>
			<span>Interface</span>
		</span>
	</button>

	<button
		type="button"
		class="dashboard-menu__link"
		class:is-active={active === 'upload'}
		on:click={() => select('upload')}
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
				/>
			</svg>
			<span>Upload &amp; Adobe Stock</span>
		</span>
	</button>

	<a
		class="dashboard-menu__link dashboard-menu__link--external"
		href="/profile"
		data-sveltekit-preload-data="hover"
	>
		<span class="dashboard-menu__label">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
				/>
			</svg>
			<span>Profil &amp; Konto</span>
		</span>
		<strong class="dashboard-menu__external-hint">Profil</strong>
	</a>
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
