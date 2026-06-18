<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { currentUserId } from '$lib/sessionStore';
	import { authFetch } from '$lib/authFetch';
	import {
		LICENSE_TIER_DESCRIPTIONS,
		LICENSE_TIER_LABELS,
		type LicenseTier
	} from '$lib/licensing/tiers';
	import { notifyCartUpdated } from '$lib/licensing/licenseCartStore';

	export let itemId: string;
	export let itemTitle = '';
	export let salesEnabled = false;
	export let standardPriceCents = 2900;
	export let extendedPriceCents = 9900;
	export let compact = false;

	let addingTier: LicenseTier | null = null;
	let cartAddedTier: LicenseTier | null = null;
	let errorMessage = '';

	function formatPrice(cents: number): string {
		return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
			cents / 100
		);
	}

	const tiers: LicenseTier[] = ['standard', 'extended'];

	async function addToCart(tier: LicenseTier) {
		errorMessage = '';
		cartAddedTier = null;
		const userId = get(currentUserId);
		if (!userId) {
			const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/';
			goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
			return;
		}

		addingTier = tier;
		try {
			const response = await authFetch('/api/cart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId, tier })
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error || data?.message || 'Warenkorb fehlgeschlagen');
			}
			notifyCartUpdated(Number(data?.count ?? data?.lines?.length ?? 0));
			cartAddedTier = tier;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Warenkorb fehlgeschlagen';
		} finally {
			addingTier = null;
		}
	}
</script>

{#if salesEnabled}
	<section class="license-purchase" class:compact aria-labelledby="license-purchase-heading">
		<h2 id="license-purchase-heading" class="license-purchase-title">
			{compact ? 'Lizenz kaufen' : 'Bildlizenz erwerben'}
		</h2>
		{#if !compact && itemTitle}
			<p class="license-purchase-subtitle">{itemTitle}</p>
		{/if}
		<p class="license-purchase-note">
			Lizenzen legen Sie in den Warenkorb und bezahlen gesammelt über Lemon Squeezy (Merchant of
			Record). Nach dem Kauf steht der Download dauerhaft in Ihrem Culoca-Konto bereit.
		</p>

		<div class="license-tiers">
			{#each tiers as t}
				<article class="license-tier-card">
					<h3>{LICENSE_TIER_LABELS[t]}</h3>
					<p class="tier-price">{formatPrice(t === 'standard' ? standardPriceCents : extendedPriceCents)}</p>
					<p class="tier-desc">{LICENSE_TIER_DESCRIPTIONS[t]}</p>
					<button
						type="button"
						class="cart-btn"
						disabled={addingTier !== null}
						on:click={() => addToCart(t)}
					>
						{addingTier === t ? 'Wird hinzugefügt …' : 'In den Warenkorb'}
					</button>
					{#if cartAddedTier === t}
						<p class="cart-added">
							Im Warenkorb. <a href="/warenkorb">Zum Warenkorb</a>
						</p>
					{/if}
				</article>
			{/each}
		</div>

		<p class="legal-hint">
			Mit dem Kauf akzeptieren Sie die
			<a href="/web/license#kommerziell">Culoca-Lizenzbedingungen</a>
			sowie die <a href="/web/license#zahlung">Zahlungs- und Rückerstattungsinfos</a>
			und <a href="/web/widerruf">Widerrufsbelehrung</a> (Lemon Squeezy).
		</p>

		{#if errorMessage}
			<p class="error" role="alert">{errorMessage}</p>
		{/if}
	</section>
{/if}

<style>
	.license-purchase {
		margin: 1.5rem 0;
		padding: 1.25rem;
		border: 1px solid var(--border-color, #ddd);
		border-radius: 12px;
		background: var(--card-bg, rgba(255, 255, 255, 0.03));
	}

	.compact {
		margin: 1rem 0;
		padding: 1rem;
	}

	.license-purchase-title {
		margin: 0 0 0.35rem;
		font-size: 1.2rem;
	}

	.license-purchase-subtitle {
		margin: 0 0 0.75rem;
		color: var(--text-secondary, #666);
	}

	.license-purchase-note,
	.legal-hint {
		font-size: 0.9rem;
		color: var(--text-secondary, #666);
		line-height: 1.45;
	}

	.license-tiers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}

	.license-tier-card {
		padding: 1rem;
		border-radius: 10px;
		border: 1px solid var(--border-color, #ddd);
	}

	.license-tier-card h3 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}

	.tier-price {
		margin: 0 0 0.5rem;
		font-size: 1.35rem;
		font-weight: 700;
	}

	.tier-desc {
		margin: 0 0 0.85rem;
		font-size: 0.88rem;
		line-height: 1.4;
		color: var(--text-secondary, #666);
	}

	.cart-btn {
		width: 100%;
		padding: 0.65rem 1rem;
		border: none;
		border-radius: 8px;
		background: #ee7221;
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}

	.cart-btn:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.cart-added {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--text-secondary, #666);
	}

	.error {
		color: #c0392b;
		margin-top: 0.75rem;
	}
</style>
