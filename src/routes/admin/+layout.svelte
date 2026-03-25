<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import SiteNav from '$lib/SiteNav.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import AdminDashboardNav from '$lib/admin/AdminDashboardNav.svelte';
	import { adminPanelTitle } from '$lib/admin/adminNav';
	import { supabase } from '$lib/supabaseClient';
	import { hasAdminPermission } from '$lib/sessionStore';
	import { fetchAllReviewItems } from '$lib/profile/review';

	$: panelTitle = adminPanelTitle($page.url.pathname);
	$: pathname = $page.url.pathname;

	let moderationPendingCount = 0;

	async function refreshModerationPending() {
		if (!$hasAdminPermission) {
			moderationPendingCount = 0;
			return;
		}
		const { data: auth } = await supabase.auth.getUser();
		const uid = auth.user?.id;
		if (!uid) {
			moderationPendingCount = 0;
			return;
		}
		try {
			const all = await fetchAllReviewItems(supabase);
			moderationPendingCount = all.filter(
				(item) => item.profile_id && item.profile_id !== uid
			).length;
		} catch {
			moderationPendingCount = 0;
		}
	}

	$: if (browser && $hasAdminPermission) {
		void refreshModerationPending();
	}

	onMount(() => {
		const id = setInterval(() => void refreshModerationPending(), 45000);
		return () => clearInterval(id);
	});
</script>

<SiteNav />

<main class="dashboard-page admin-dashboard-page">
	<section class="dashboard-page__hero admin-dashboard__hero">
		<div class="admin-dashboard__hero-row">
			<div>
				<h1 class="admin-dashboard__title">Administration</h1>
				<p class="admin-dashboard__sub">Rollen, Benutzer, Inhalte und Auswertungen verwalten.</p>
			</div>
		</div>
	</section>

	<section class="dashboard-layout">
		<aside class="dashboard-column dashboard-column--menu">
			<AdminDashboardNav {pathname} {moderationPendingCount} />
		</aside>
		<section class="dashboard-column dashboard-column--content">
			<div class="panel-head">
				<h2>{panelTitle}</h2>
			</div>
			<div class="admin-dashboard__inner">
				<slot />
			</div>
		</section>
	</section>
</main>

<SiteFooter />

<style>
	.admin-dashboard-page {
		min-height: 100vh;
		background: var(--bg-primary);
		color: var(--text-primary);
		padding: 1.4rem 2rem 2.2rem;
		box-sizing: border-box;
	}

	.admin-dashboard__hero {
		margin-bottom: 0;
	}

	.admin-dashboard__hero-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.admin-dashboard__title {
		margin: 0;
		font-size: clamp(1.8rem, 3vw, 2.4rem);
		font-weight: 700;
		color: var(--text-primary);
	}

	.admin-dashboard__sub {
		margin: 0.45rem 0 0;
		color: var(--text-secondary);
		max-width: 42rem;
	}

	.dashboard-layout {
		margin-top: 1.2rem;
		display: grid;
		gap: 1rem;
		grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
		align-items: start;
	}

	.dashboard-column--menu {
		position: sticky;
		top: 4.6rem;
	}

	.dashboard-column {
		border: 1px solid var(--border-color);
		border-radius: 16px;
		background: var(--bg-secondary);
		padding: 1rem;
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.8rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.panel-head h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.admin-dashboard__inner {
		border: none;
		padding: 0;
		background: transparent;
		min-width: 0;
	}

	@media (max-width: 980px) {
		.admin-dashboard-page {
			padding: 1rem;
		}

		.dashboard-layout {
			grid-template-columns: 1fr;
		}

		.dashboard-column--menu {
			position: static;
		}
	}
</style>
