<script lang="ts">
	import { onMount } from 'svelte';
	import { authFetch } from '$lib/authFetch';
	import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
	import {
		LICENSE_TIER_DESCRIPTIONS,
		LICENSE_TIER_LABELS
	} from '$lib/licensing/tiers';

	export let showPurchaseSuccess = false;
	export let showLicenseIntro = true;
	export let title = 'Gekaufte Lizenzen';

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
	let bulkBusy = false;
	let bulkError = '';

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
		void loadLicenses();
	});

	export async function loadLicenses() {
		loading = true;
		error = '';
		try {
			const response = await authFetch('/api/licenses');
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error || data?.message || 'Lizenzen konnten nicht geladen werden');
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

	async function bulkDownload() {
		if (!licenses.length || bulkBusy) return;
		bulkBusy = true;
		bulkError = '';
		try {
			const response = await authFetch('/api/licenses/bulk-download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data?.message || data?.error || 'ZIP-Download fehlgeschlagen');
			}
			const blob = await response.blob();
			const stamp = new Date().toISOString().slice(0, 10);
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `culoca-lizenzen-${stamp}.zip`;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			bulkError = e instanceof Error ? e.message : 'Download fehlgeschlagen';
		} finally {
			bulkBusy = false;
		}
	}
</script>

<div class="licensed-panel">
	{#if title}
		<h2 class="panel-title">{title}</h2>
	{/if}

	{#if showLicenseIntro}
		<div class="license-intro">
			<p>
				Hier finden Sie alle auf culoca.com erworbenen Bildlizenzen. Rechnung und Zahlung laufen über
				Lemon Squeezy. Downloads können Sie jederzeit erneut starten — einzeln mit allen
				Export-Optionen oder gesammelt als ZIP in voller Auflösung.
			</p>
			<ul class="tier-hints">
				<li>
					<strong>{LICENSE_TIER_LABELS.standard}:</strong>
					{LICENSE_TIER_DESCRIPTIONS.standard}
				</li>
				<li>
					<strong>{LICENSE_TIER_LABELS.extended}:</strong>
					{LICENSE_TIER_DESCRIPTIONS.extended}
				</li>
			</ul>
			<p class="legal-link">
				<a href="/web/license#kommerziell">Allgemeine Lizenzbedingungen</a>
			</p>
		</div>
	{/if}

	{#if showPurchaseSuccess}
		<p class="success-banner" role="status">
			Vielen Dank für Ihren Kauf! Ihre Lizenzen sind unten aufgeführt.
		</p>
	{/if}

	{#if loading}
		<p class="muted">Lade Lizenzen …</p>
	{:else if error}
		<p class="error" role="alert">{error}</p>
	{:else if licenses.length === 0}
		<p class="muted">Noch keine gekauften Lizenzen.</p>
	{:else}
		<div class="toolbar">
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
			{#if licenses.length >= 2}
				<button type="button" class="bulk-btn" disabled={bulkBusy} on:click={bulkDownload}>
					{bulkBusy ? 'ZIP wird erstellt …' : `Alle ${licenses.length} als ZIP (Original)`}
				</button>
			{/if}
		</div>
		{#if bulkError}
			<p class="error" role="alert">{bulkError}</p>
		{/if}
		{#if licenses.length >= 2}
			<p class="bulk-hint muted">
				Sammeldownload: volle Auflösung, Originaldateinamen. Für Zuschnitt, Format und Metadaten nutzen
				Sie den Download-Dialog pro Bild.
			</p>
		{/if}

		<ul class="license-list">
			{#each filteredLicenses as license (license.id)}
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
						<h3>
							{#if license.itemHref}
								<a href={license.itemHref}>{license.itemTitle || 'Bild'}</a>
							{:else}
								{license.itemTitle || 'Bild'}
							{/if}
						</h3>
						<p>
							<strong>{license.licenseTierLabel || LICENSE_TIER_LABELS.standard}</strong>
							· {formatDate(license.purchasedAt)}
							{#if license.orderNumber}
								· Bestellung {license.orderNumber}
							{/if}
						</p>
						<p>{formatPrice(license.priceCents, license.currency)}</p>
						{#if license.downloadHref}
							<a class="download-link" href={license.downloadHref}>Download &amp; Export</a>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.licensed-panel {
		display: grid;
		gap: 0.85rem;
	}

	.panel-title {
		margin: 0;
		font-size: 1.35rem;
	}

	.license-intro {
		max-width: 68ch;
		color: var(--text-secondary, #666);
	}

	.license-intro p {
		margin: 0 0 0.65rem;
	}

	.tier-hints {
		margin: 0 0 0.65rem;
		padding-left: 1.2rem;
	}

	.tier-hints li {
		margin: 0.25rem 0;
	}

	.legal-link {
		margin: 0;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.search-field input {
		width: min(360px, 100%);
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color, #ddd);
		border-radius: 8px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.bulk-btn {
		border: 1px solid color-mix(in srgb, var(--culoca-orange, #ee7221) 45%, var(--border-color) 55%);
		background: color-mix(in srgb, var(--culoca-orange, #ee7221) 10%, var(--bg-primary) 90%);
		color: var(--text-primary);
		border-radius: 10px;
		padding: 0.55rem 0.85rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.bulk-btn:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.bulk-hint {
		margin: 0;
		font-size: 0.92rem;
	}

	.license-list {
		list-style: none;
		margin: 0.25rem 0 0;
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
		background: var(--bg-primary);
	}

	.thumb {
		width: 96px;
		height: 96px;
		object-fit: cover;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.meta h3 {
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
		margin: 0;
	}

	.muted {
		color: var(--text-secondary, #666);
		margin: 0;
	}

	.success-banner {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 10px;
		background: color-mix(in srgb, #2d8a4e 12%, var(--bg-primary));
		border: 1px solid color-mix(in srgb, #2d8a4e 35%, var(--border-color));
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
</style>
