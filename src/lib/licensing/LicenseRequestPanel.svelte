<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { currentUserId } from '$lib/sessionStore';
	import { openLicenseRequestChat } from '$lib/licensing/openLicenseRequestChat';

	export let itemId: string;
	export let itemTitle = '';
	export let creatorUserId: string | null = null;
	export let compact = false;
	/** Ohne äußeren Rahmen/Hintergrund */
	export let embedded = false;

	async function requestLicense() {
		const userId = get(currentUserId);
		if (!userId) {
			const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/';
			await goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
			return;
		}
		if (!creatorUserId) return;
		openLicenseRequestChat({ creatorUserId, itemId, itemTitle });
	}
</script>

{#if creatorUserId}
	<section class="license-request" class:compact class:embedded aria-labelledby="license-request-heading">
		<h2 id="license-request-heading" class="license-request-title">
			{compact ? 'Lizenz anfragen' : 'Kommerzielle Lizenz'}
		</h2>
		{#if !compact && itemTitle}
			<p class="license-request-subtitle">{itemTitle}</p>
		{/if}
		<p class="license-request-note">
			Dieses Bild ist derzeit nicht im Culoca-Shop freigegeben. Sie können den Ersteller per
			Nachricht kontaktieren — Culoca prüft Freigaben und Rechte vor einem Verkauf.
		</p>
		<button type="button" class="request-btn" on:click={requestLicense}>
			Lizenz anfragen
		</button>
		<p class="legal-hint">
			<a href="/web/license#kommerziell">Lizenzinformationen</a>
		</p>
	</section>
{/if}

<style>
	.license-request {
		margin: 1.25rem 0;
		padding: 1.25rem;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		background: var(--bg-secondary);
	}

	.license-request.compact {
		padding: 1rem;
	}

	.embedded {
		margin: 1.25rem 0 0;
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
	}

	.embedded.compact {
		margin: 1rem 0 0;
		padding: 0;
	}

	.license-request-title {
		margin: 0 0 0.35rem;
		font-size: 1.15rem;
	}

	.license-request-subtitle {
		margin: 0 0 0.75rem;
		color: var(--text-secondary);
	}

	.license-request-note {
		margin: 0 0 1rem;
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.request-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.65rem 1.1rem;
		border-radius: 8px;
		border: none;
		background: var(--culoca-orange, #ee7221);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}

	.request-btn:hover {
		filter: brightness(1.05);
	}

	.legal-hint {
		margin: 0.85rem 0 0;
		font-size: 0.85rem;
		color: var(--text-muted);
	}
</style>
