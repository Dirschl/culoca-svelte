<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import SiteNav from '$lib/SiteNav.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import SettingsDashboardNav from '$lib/settings/SettingsDashboardNav.svelte';
	import { authFetch } from '$lib/authFetch';
	import { goto } from '$app/navigation';
	import { sessionStore, sessionReady } from '$lib/sessionStore';
	import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
	import { LICENSE_TIER_LABELS } from '$lib/licensing/tiers';

	type LicenseRow = {
		id: string;
		itemId: string;
		licenseTier: string;
		licenseTierLabel: string;
		purchasedAt: string;
		orderNumber: string | null;
		priceCents: number | null;
		currency: string | null;
		itemTitle: string | null;
		itemHref: string | null;
		downloadHref: string | null;
		itemSlug: string | null;
		previewPath: string | null;
	};

	let loading = true;
	let error = '';
	let licenses: LicenseRow[] = [];
	let searchQuery = '';
	let showPurchaseSuccess = false;

	$: filteredLicenses = searchQuery.trim()
		? licenses.filter((license) => {
				const q = searchQuery.trim().toLowerCase();
				return (
					(license.itemTitle || '').toLowerCase().includes(q) ||
					(license.itemSlug || '').toLowerCase().includes(q) ||
					(license.orderNumber || '').toLowerCase().includes(q)
				);
			})
		: licenses;

	onMount(() => {
		showPurchaseSuccess = $page.url.searchParams.get('purchase') === 'success';
		let loaded = false;
		return sessionReady.subscribe(async (ready) => {
			if (!ready || loaded) return;
			const session = sessionStore.get();
			if (!session.isAuthenticated || !session.userId) {
				goto(`/login?returnTo=${encodeURIComponent('/settings/licenses')}`);
				return;
			}
			loaded = true;
			await loadLicenses();
		});
	});

	async function loadLicenses() {
		loading = true;
		error = '';
		try {
			const response = await authFetch('/api/licenses');
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error || 'Lizenzen konnten nicht geladen werden');
			}
			licenses = data.licenses || [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden';
		} finally {
			loading = false;
		}
	}

	function formatDate(value: string) {
		try {
			return new Date(value).toLocaleString('de-DE');
		} catch {
			return value;
		}
	}

	function formatPrice(cents: number | null, currency: string | null) {
		if (cents == null) return '—';
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: (currency || 'EUR').toUpperCase()
		}).format(cents / 100);
	}
</script>

<svelte:head>
	<title>Meine Lizenzen | Culoca</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<SiteNav />
	<main class="settings-shell">
		<SettingsDashboardNav active="licenses" />
		<section class="content">
			<h1>Meine Lizenzen</h1>
			<p class="intro">
				Hier finden Sie alle gekauften Bildlizenzen. Rechnungen und Zahlungen werden über Lemon
				Squeezy abgewickelt. Downloads können Sie jederzeit erneut starten.
			</p>

			{#if showPurchaseSuccess}
				<p class="success-banner" role="status">
					Vielen Dank für Ihren Kauf! Ihre Lizenzen sind unten aufgeführt. Der Warenkorb wurde
					geleert.
				</p>
			{/if}

			{#if loading}
				<p>Lade Lizenzen …</p>
			{:else if error}
				<p class="error" role="alert">{error}</p>
			{:else if licenses.length === 0}
				<p>Noch keine gekauften Lizenzen.</p>
			{:else}
				{#if licenses.length > 5}
					<label class="search-field">
						<span class="sr-only">Lizenzen durchsuchen</span>
						<input
							type="search"
							placeholder="Titel, Slug oder Bestellnummer …"
							bind:value={searchQuery}
						/>
					</label>
				{/if}
				<ul class="license-list">
					{#each filteredLicenses as license}
						<li class="license-card">
							{#if license.itemSlug && license.previewPath}
								<img
									class="thumb"
									src={getSeoImageUrl(license.itemSlug, license.previewPath, '512')}
									alt={license.itemTitle || 'Lizenziertes Bild'}
									width="96"
									height="96"
									loading="lazy"
								/>
							{/if}
							<div class="meta">
								<h2>
									{#if license.itemHref}
										<a href={license.itemHref}>{license.itemTitle || 'Bild'}</a>
									{:else}
										{license.itemTitle || 'Bild'}
									{/if}
								</h2>
								<p>
									<strong>{license.licenseTierLabel || LICENSE_TIER_LABELS.standard}</strong>
									· {formatDate(license.purchasedAt)}
									{#if license.orderNumber}
										· Bestellung {license.orderNumber}
									{/if}
								</p>
								<p>{formatPrice(license.priceCents, license.currency)}</p>
								{#if license.downloadHref}
									<a class="download-link" href={license.downloadHref}>Erneut herunterladen</a>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
	<SiteFooter />
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.settings-shell {
		display: grid;
		grid-template-columns: minmax(200px, 260px) 1fr;
		gap: 1.5rem;
		width: min(1100px, 100%);
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		flex: 1;
	}

	.intro {
		color: var(--text-secondary, #666);
		max-width: 60ch;
	}

	.license-list {
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		display: grid;
		gap: 1rem;
	}

	.license-card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--border-color, #ddd);
		border-radius: 12px;
	}

	.thumb {
		width: 96px;
		height: 96px;
		object-fit: cover;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.meta h2 {
		margin: 0 0 0.35rem;
		font-size: 1.05rem;
	}

	.meta p {
		margin: 0.2rem 0;
	}

	.download-link {
		display: inline-block;
		margin-top: 0.5rem;
		font-weight: 600;
	}

	.error {
		color: #c0392b;
	}

	.success-banner {
		margin: 1rem 0;
		padding: 0.85rem 1rem;
		border-radius: 10px;
		background: color-mix(in srgb, #2d8a4e 12%, var(--bg-primary));
		border: 1px solid color-mix(in srgb, #2d8a4e 35%, var(--border-color));
		color: var(--text-primary);
	}

	.search-field input {
		width: 100%;
		max-width: 360px;
		margin: 0.75rem 0 0.25rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color, #ddd);
		border-radius: 8px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	@media (max-width: 760px) {
		.settings-shell {
			grid-template-columns: 1fr;
		}
	}
</style>
