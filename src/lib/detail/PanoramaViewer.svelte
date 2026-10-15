<script lang="ts">
	import { onMount } from 'svelte';
	import '@photo-sphere-viewer/core/index.css';

	export let panoramaUrl: string;
	export let posterUrl: string;
	export let alt = 'Interaktives 360°-Panorama';
	export let backHref = '/';
	export let headingDegrees = 0;

	let viewerElement: HTMLDivElement;
	let ready = false;
	let failed = false;

	onMount(() => {
		let destroyed = false;
		let viewer: import('@photo-sphere-viewer/core').Viewer | null = null;

		void (async () => {
			try {
				const { Viewer, events } = await import('@photo-sphere-viewer/core');
				if (destroyed) return;
				viewer = new Viewer({
					container: viewerElement,
					panorama: panoramaUrl,
					caption: alt,
					loadingTxt: '360°-Panorama wird geladen …',
					defaultYaw: `${Number.isFinite(headingDegrees) ? headingDegrees : 0}deg`,
					defaultZoomLvl: 38,
					minFov: 35,
					maxFov: 95,
					mousewheelCtrlKey: false,
					touchmoveTwoFingers: false,
					navbar: ['zoom', 'move', 'caption', 'fullscreen']
				});
				viewer.addEventListener(events.ReadyEvent.type, () => {
					ready = true;
				});
				viewer.addEventListener(events.PanoramaErrorEvent.type, () => {
					failed = true;
				});
			} catch (error) {
				console.error('[PanoramaViewer] Viewer konnte nicht gestartet werden:', error);
				failed = true;
			}
		})();

		return () => {
			destroyed = true;
			viewer?.destroy();
		};
	});
</script>

<section class="panorama-shell" aria-label={alt}>
	<img
		src={posterUrl}
		{alt}
		class:poster-hidden={ready && !failed}
		class="panorama-poster"
		loading="eager"
		decoding="async"
		fetchpriority="high"
	/>
	<div bind:this={viewerElement} class="panorama-viewer" class:viewer-ready={ready && !failed}></div>
	<a class="panorama-back" href={backHref || '/'} aria-label="Zur vorherigen Übersicht zurückkehren">
		<span aria-hidden="true">←</span> Zurück
	</a>
	<div class="panorama-hint" class:hint-hidden={ready || failed} aria-live="polite">
		360° wird geladen …
	</div>
	{#if failed}
		<div class="panorama-error" role="status">
			Die interaktive Ansicht konnte nicht geladen werden. Das Vorschaubild bleibt verfügbar.
		</div>
	{/if}
</section>

<style>
	.panorama-shell {
		position: relative;
		width: 100%;
		min-height: min(68vh, 760px);
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: #111;
	}

	.panorama-poster,
	.panorama-viewer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.panorama-poster {
		z-index: 1;
		object-fit: cover;
		transition: opacity 180ms ease;
	}

	.poster-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.panorama-viewer {
		z-index: 0;
		opacity: 0;
		transition: opacity 180ms ease;
	}

	.viewer-ready {
		z-index: 2;
		opacity: 1;
	}

	.panorama-back,
	.panorama-hint,
	.panorama-error {
		position: absolute;
		z-index: 5;
		background: rgba(0, 0, 0, 0.68);
		color: #fff;
		-webkit-backdrop-filter: blur(5px);
		backdrop-filter: blur(5px);
	}

	.panorama-back {
		top: 10px;
		left: 10px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 11px;
		border-radius: 999px;
		font-size: 0.88rem;
		font-weight: 700;
		text-decoration: none;
	}

	.panorama-back:focus-visible {
		outline: 3px solid #fff;
		outline-offset: 2px;
	}

	.panorama-hint {
		left: 50%;
		bottom: 16px;
		transform: translateX(-50%);
		padding: 7px 12px;
		border-radius: 999px;
		font-size: 0.85rem;
		transition: opacity 180ms ease;
	}

	.hint-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.panorama-error {
		left: 12px;
		right: 12px;
		bottom: 12px;
		padding: 9px 12px;
		border-radius: 8px;
		font-size: 0.85rem;
		text-align: center;
	}

	@media (max-width: 700px) {
		.panorama-shell {
			min-height: 58vh;
			aspect-ratio: auto;
		}
	}
</style>
