<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SiteNav from '$lib/SiteNav.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import { authFetch } from '$lib/authFetch';
	import { sessionStore, sessionReady } from '$lib/sessionStore';
	import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
	import {
		LICENSE_TIER_LABELS,
		type LicenseTier
	} from '$lib/licensing/tiers';
	import type { CartLineDisplay } from '$lib/licensing/cart';
	import { MAX_CART_ITEMS } from '$lib/licensing/cart';
	import { notifyCartUpdated } from '$lib/licensing/licenseCartStore';
	import { redirectToLemonCheckout } from '$lib/licensing/lemonCheckoutClient';

	let loading = true;
	let checkoutLoading = false;
	let errorMessage = '';
	let lines: CartLineDisplay[] = [];
	let totalCents = 0;
	let payableCount = 0;
	let searchQuery = '';

	onMount(() => {
		let loaded = false;
		return sessionReady.subscribe(async (ready) => {
			if (!ready || loaded) return;
			const session = sessionStore.get();
			if (!session.isAuthenticated || !session.userId) {
				goto(`/login?returnTo=${encodeURIComponent('/warenkorb')}`);
				return;
			}
			loaded = true;
			await loadCart();
		});
	});

	async function loadCart() {
		loading = true;
		errorMessage = '';
		try {
			const response = await authFetch('/api/cart');
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error || data?.message || 'Warenkorb konnte nicht geladen werden');
			}
			lines = data.lines || [];
			totalCents = Number(data.totalCents ?? 0);
			payableCount = Number(data.payableCount ?? 0);
			notifyCartUpdated(Number(data?.count ?? data?.lines?.length ?? 0));
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Fehler beim Laden';
		} finally {
			loading = false;
		}
	}

	$: filteredLines = searchQuery.trim()
		? lines.filter((line) => {
				const q = searchQuery.trim().toLowerCase();
				return (
					(line.item_title || '').toLowerCase().includes(q) ||
					(line.item_slug || '').toLowerCase().includes(q)
				);
			})
		: lines;

	function formatPrice(cents: number): string {
		return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
	}

	function handleTierChange(itemId: string, event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (value === 'standard' || value === 'extended') {
			void setTier(itemId, value);
		}
	}

	async function removeLine(itemId: string) {
		errorMessage = '';
		try {
			const response = await authFetch(`/api/cart?itemId=${encodeURIComponent(itemId)}`, {
				method: 'DELETE'
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || 'Entfernen fehlgeschlagen');
			lines = data.lines || [];
			totalCents = Number(data.totalCents ?? 0);
			payableCount = Number(data.payableCount ?? 0);
			notifyCartUpdated(Number(data?.count ?? data?.lines?.length ?? 0));
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Entfernen fehlgeschlagen';
		}
	}

	async function setTier(itemId: string, tier: LicenseTier) {
		errorMessage = '';
		try {
			const response = await authFetch('/api/cart', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId, tier })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || 'Aktualisierung fehlgeschlagen');
			lines = data.lines || [];
			totalCents = Number(data.totalCents ?? 0);
			payableCount = Number(data.payableCount ?? 0);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Aktualisierung fehlgeschlagen';
		}
	}

	async function setAllTiers(tier: LicenseTier) {
		errorMessage = '';
		try {
			const response = await authFetch('/api/cart', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ setAllTier: tier })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || 'Aktualisierung fehlgeschlagen');
			lines = data.lines || [];
			totalCents = Number(data.totalCents ?? 0);
			payableCount = Number(data.payableCount ?? 0);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Aktualisierung fehlgeschlagen';
		}
	}

	async function clearAll() {
		if (!confirm('Warenkorb wirklich leeren?')) return;
		errorMessage = '';
		try {
			const response = await authFetch('/api/cart', { method: 'DELETE' });
			const data = await response.json();
			if (!response.ok) throw new Error(data?.error || 'Leeren fehlgeschlagen');
			lines = [];
			totalCents = 0;
			payableCount = 0;
			notifyCartUpdated(0);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Leeren fehlgeschlagen';
		}
	}

	async function startCheckout() {
		errorMessage = '';
		checkoutLoading = true;
		try {
			const response = await authFetch('/api/checkout/cart', { method: 'POST' });
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error || data?.message || 'Checkout fehlgeschlagen');
			}
			if (data.checkoutUrl) {
				redirectToLemonCheckout(data.checkoutUrl);
				return;
			}
			throw new Error('Keine Checkout-URL erhalten');
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Checkout fehlgeschlagen';
		} finally {
			checkoutLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Warenkorb | Culoca</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<SiteNav />
	<main class="cart-main">
		<header class="cart-header">
			<h1>Warenkorb</h1>
			<p class="intro">
				Sammeln Sie Bildlizenzen und bezahlen Sie alle Positionen in einem Checkout über Lemon
				Squeezy. Maximal {MAX_CART_ITEMS} Bilder pro Warenkorb.
			</p>
		</header>

		{#if loading}
			<p>Lade Warenkorb …</p>
		{:else if lines.length === 0}
			<p class="empty">Ihr Warenkorb ist leer.</p>
			<a class="browse-link" href="/foto">Fotos durchsuchen</a>
		{:else}
			<div class="toolbar">
				{#if lines.length > 5}
					<label class="search-field">
						<span class="sr-only">Warenkorb durchsuchen</span>
						<input
							type="search"
							placeholder="Titel oder Slug suchen …"
							bind:value={searchQuery}
						/>
					</label>
				{/if}
				<div class="bulk-actions">
					<span>Alle auf:</span>
					<button type="button" class="ghost-btn" on:click={() => setAllTiers('standard')}>
						Standard
					</button>
					<button type="button" class="ghost-btn" on:click={() => setAllTiers('extended')}>
						Erweitert
					</button>
					<button type="button" class="ghost-btn danger" on:click={clearAll}>Leeren</button>
				</div>
			</div>

			<ul class="cart-list">
				{#each filteredLines as line (line.id)}
					<li class="cart-row" class:licensed={line.already_licensed}>
						{#if line.item_slug && line.preview_path}
							<img
								class="thumb"
								src={getSeoImageUrl(line.item_slug, line.preview_path, '512')}
								alt={line.item_title || 'Vorschau'}
								width="80"
								height="80"
								loading="lazy"
							/>
						{/if}
						<div class="meta">
							<h2>
								{#if line.item_href}
									<a href={line.item_href}>{line.item_title || line.item_slug || 'Bild'}</a>
								{:else}
									{line.item_title || 'Bild'}
								{/if}
							</h2>
							{#if line.already_licensed}
								<p class="warn">
									Sie besitzen bereits eine Lizenz — wird beim Checkout übersprungen.
									<a href="/dashboard?section=licenses">Gekaufte Lizenzen im Konto</a>
								</p>
							{/if}
							<div class="tier-row">
								<label>
									Lizenz:
									<select
										value={line.license_tier}
										disabled={line.already_licensed}
										on:change={(e) => handleTierChange(line.item_id, e)}
									>
										<option value="standard">{LICENSE_TIER_LABELS.standard}</option>
										<option value="extended">{LICENSE_TIER_LABELS.extended}</option>
									</select>
								</label>
								<span class="price">{formatPrice(line.price_cents)}</span>
							</div>
						</div>
						<button
							type="button"
							class="remove-btn"
							aria-label="Aus Warenkorb entfernen"
							on:click={() => removeLine(line.item_id)}
						>
							×
						</button>
					</li>
				{/each}
			</ul>

			<footer class="cart-footer">
				<div class="totals">
					<p>
						<strong>{payableCount}</strong> von {lines.length} Positionen zur Zahlung
					</p>
					<p class="total-price">Gesamt: {formatPrice(totalCents)}</p>
				</div>
				<button
					type="button"
					class="checkout-btn"
					disabled={checkoutLoading || payableCount === 0}
					on:click={startCheckout}
				>
					{checkoutLoading ? 'Weiterleitung …' : 'Zur Kasse'}
				</button>
				<div class="cart-checkout-notes">
					<p class="legal-hint">
						Mit dem Kauf akzeptieren Sie die
						<a href="/web/license#kommerziell">Culoca-Lizenzbedingungen</a>
						sowie die <a href="/web/license#zahlung">Zahlungs- und Rückerstattungsinfos</a>
						und <a href="/web/widerruf">Widerrufsbelehrung</a> (Lemon Squeezy).
					</p>
					<p class="download-hint">
						In Culoca werden die erworbenen Lizenzen im
						<a href="/dashboard?section=licenses">Dashboard → Gekaufte Lizenzen</a>
						zum Download in voller Auflösung bereitgestellt. Im Einzeldownload können Sie
						zusätzlich das Format selbst festlegen.
					</p>
				</div>
			</footer>
		{/if}

		{#if errorMessage}
			<p class="error" role="alert">{errorMessage}</p>
		{/if}
	</main>
	<SiteFooter />
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.cart-main {
		width: min(900px, 100%);
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		flex: 1;
	}

	.intro,
	.empty {
		color: var(--text-secondary, #666);
		max-width: 60ch;
	}

	.cart-checkout-notes {
		margin-top: 1.15rem;
		display: grid;
		gap: 0.65rem;
		max-width: 62ch;
	}

	.legal-hint,
	.download-hint {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-secondary, #666);
	}

	.legal-hint a,
	.download-hint a {
		color: var(--culoca-orange, #ee7221);
		font-weight: 600;
		text-decoration: none;
	}

	.legal-hint a:hover,
	.download-hint a:hover {
		text-decoration: underline;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		margin: 1rem 0;
	}

	.search-field input {
		min-width: 220px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color, #ddd);
		border-radius: 8px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.bulk-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.ghost-btn {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border-color, #ddd);
		border-radius: 8px;
		background: var(--bg-secondary);
		cursor: pointer;
		font: inherit;
	}

	.ghost-btn.danger {
		color: #c0392b;
	}

	.cart-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.85rem;
	}

	.cart-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 1rem;
		align-items: start;
		padding: 1rem;
		border: 1px solid var(--border-color, #ddd);
		border-radius: 12px;
	}

	.cart-row.licensed {
		opacity: 0.75;
	}

	.thumb {
		width: 80px;
		height: 80px;
		object-fit: cover;
		border-radius: 8px;
	}

	.meta h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}

	.tier-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	.tier-row select {
		margin-left: 0.35rem;
		padding: 0.35rem;
		border-radius: 6px;
		border: 1px solid var(--border-color, #ddd);
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.price {
		font-weight: 700;
	}

	.warn {
		color: #b45309;
		font-size: 0.88rem;
		margin: 0.2rem 0;
	}

	.warn a {
		font-weight: 600;
	}

	.remove-btn {
		border: none;
		background: none;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		color: var(--text-secondary, #666);
		padding: 0.25rem;
	}

	.cart-footer {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color, #ddd);
	}

	.total-price {
		font-size: 1.35rem;
		font-weight: 700;
	}

	.checkout-btn {
		margin-top: 0.75rem;
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 10px;
		background: #ee7221;
		color: #fff;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
	}

	.checkout-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.browse-link {
		display: inline-block;
		margin-top: 0.5rem;
		font-weight: 600;
	}

	.error {
		color: #c0392b;
		margin-top: 1rem;
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
