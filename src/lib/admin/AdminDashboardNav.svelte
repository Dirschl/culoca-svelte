<script lang="ts">
	import { ADMIN_NAV_ITEMS } from './adminNav';

	export let pathname: string;
</script>

<nav class="dashboard-menu" aria-label="Administration Navigation">
	{#each ADMIN_NAV_ITEMS as item}
		<a
			href={item.href}
			class="dashboard-menu__link"
			class:is-active={pathname === item.href || pathname.startsWith(item.href + '/')}
			data-sveltekit-preload-data="hover"
		>
			<span class="dashboard-menu__label">
				{#if item.id === 'roles'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
						/>
					</svg>
				{:else if item.id === 'users'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
						/>
					</svg>
				{:else if item.id === 'items'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
						/>
					</svg>
				{:else if item.id === 'moderation'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
						/>
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
						/>
					</svg>
				{/if}
				<span>{item.label}</span>
			</span>
		</a>
	{/each}
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
		text-decoration: none;
	}

	.dashboard-menu__label {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.dashboard-menu__link.is-active {
		border-color: color-mix(in srgb, var(--culoca-orange) 45%, var(--border-color) 55%);
		background: color-mix(in srgb, var(--culoca-orange) 10%, var(--bg-primary) 90%);
	}
</style>
