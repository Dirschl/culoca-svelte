<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import exifr from 'exifr';
	import SiteNav from '$lib/SiteNav.svelte';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import { authFetch } from '$lib/authFetch';
	import { supabase } from '$lib/supabaseClient';
	import type { PageData } from './$types';

	export let data: PageData;

	const MAX_OUTPUT_BYTES = 45 * 1024 * 1024;
	const MAX_WIDTH = 8192;
	const MAX_HEIGHT = 4096;

	let sourceFile: File | null = null;
	let processedFile: File | null = null;
	let previewUrl = '';
	let width = 0;
	let height = 0;
	let outputBytes = 0;
	let outputQuality = 0;
	let detectionSource: 'xmp' | 'aspect-ratio' | 'manual' = 'manual';
	let headingDegrees = 0;
	let exifData: Record<string, unknown> = {};
	let processing = false;
	let uploading = false;
	let progressText = '';
	let errorMessage = '';
	let loggedIn = false;

	const source = data.sourceItem as any;
	let title = source?.title ? `${source.title} – 360° Panorama` : '';
	let caption = source?.caption || '';
	let description = source?.description || '';
	let keywords = Array.isArray(source?.keywords)
		? [...source.keywords, '360°', 'Panorama'].filter((v, i, a) => a.indexOf(v) === i).join(', ')
		: '360°, Panorama';
	let lat = source?.lat != null ? String(source.lat) : '';
	let lon = source?.lon != null ? String(source.lon) : '';

	onMount(async () => {
		const { data: sessionData } = await supabase.auth.getSession();
		loggedIn = !!sessionData.session;
	});

	function humanBytes(bytes: number) {
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	function hasGpanoMetadata(value: unknown): boolean {
		if (!value || typeof value !== 'object') return false;
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			if (/ProjectionType/i.test(key) && String(child).toLowerCase() === 'equirectangular') return true;
			if (/UsePanoramaViewer/i.test(key) && (child === true || String(child).toLowerCase() === 'true')) return true;
			if (hasGpanoMetadata(child)) return true;
		}
		return false;
	}

	function readHeading(value: unknown): number | null {
		if (!value || typeof value !== 'object') return null;
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			if (/PoseHeadingDegrees/i.test(key)) {
				const parsed = Number(child);
				if (Number.isFinite(parsed)) return parsed;
			}
			const nested = readHeading(child);
			if (nested != null) return nested;
		}
		return null;
	}

	function exifForUpload(value: Record<string, unknown>) {
		const keys = [
			'Make', 'Model', 'LensModel', 'DateTimeOriginal', 'CreateDate', 'ModifyDate',
			'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'Artist', 'Copyright',
			'ImageDescription', 'XPTitle', 'XPComment', 'XPKeywords', 'Caption', 'Description',
			'Keywords', 'Subject', 'ProjectionType', 'UsePanoramaViewer', 'PoseHeadingDegrees',
			'FullPanoWidthPixels', 'FullPanoHeightPixels', 'CroppedAreaImageWidthPixels',
			'CroppedAreaImageHeightPixels', 'CroppedAreaLeftPixels', 'CroppedAreaTopPixels'
		];
		const compact: Record<string, unknown> = {};
		for (const key of keys) {
			const field = value[key];
			if (field == null) continue;
			if (field instanceof Date) compact[key] = field.toISOString();
			else if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') compact[key] = field;
			else if (Array.isArray(field)) compact[key] = field.slice(0, 50);
		}
		compact.ProjectionType = 'equirectangular';
		compact.UsePanoramaViewer = true;
		compact.PoseHeadingDegrees = headingDegrees;
		return compact;
	}

	function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('JPEG konnte nicht erzeugt werden.'))),
				'image/jpeg',
				quality
			);
		});
	}

	async function processSelectedFile(file: File) {
		errorMessage = '';
		processing = true;
		progressText = 'Metadaten und Abmessungen werden geprüft …';
		processedFile = null;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = '';

		try {
			if (!file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
			if (file.size > 300 * 1024 * 1024) {
				throw new Error('Die Quelldatei ist größer als 300 MB und kann nicht im Browser verarbeitet werden.');
			}

			try {
				exifData = (await exifr.parse(file, { iptc: true, xmp: true, gps: true })) || {};
			} catch {
				exifData = {};
			}

			const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
			const sourceWidth = bitmap.width;
			const sourceHeight = bitmap.height;
			const ratio = sourceWidth / sourceHeight;
			if (Math.abs(ratio - 2) > 0.01) {
				bitmap.close();
				throw new Error(
					`Das Bild hat ${sourceWidth}×${sourceHeight} Pixel. Für ein vollständiges 360°-Panorama ist ein 2:1-Format erforderlich.`
				);
			}

			detectionSource = hasGpanoMetadata(exifData) ? 'xmp' : 'aspect-ratio';
			headingDegrees = readHeading(exifData) ?? 0;
			width = Math.min(sourceWidth, MAX_WIDTH);
			height = Math.min(sourceHeight, MAX_HEIGHT, Math.round(width / 2));
			progressText = `Erzeuge die 360°-Fassung mit ${width}×${height} Pixeln …`;

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext('2d', { alpha: false });
			if (!context) {
				bitmap.close();
				throw new Error('Der Browser kann das Panorama nicht verarbeiten.');
			}
			context.imageSmoothingEnabled = true;
			context.imageSmoothingQuality = 'high';
			context.drawImage(bitmap, 0, 0, width, height);
			bitmap.close();

			let blob: Blob | null = null;
			for (const quality of [0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6]) {
				progressText = `Komprimiere Panorama (${Math.round(quality * 100)} % Qualität) …`;
				blob = await canvasToJpeg(canvas, quality);
				if (blob.size <= MAX_OUTPUT_BYTES) {
					outputQuality = quality;
					break;
				}
			}

			canvas.width = 1;
			canvas.height = 1;
			if (!blob || blob.size > MAX_OUTPUT_BYTES) {
				throw new Error('Das Panorama konnte nicht unter 45 MB komprimiert werden.');
			}

			const baseName = file.name.replace(/\.[^.]+$/, '') || 'panorama-360';
			processedFile = new File([blob], `${baseName}-culoca-360.jpg`, { type: 'image/jpeg' });
			outputBytes = blob.size;
			previewUrl = URL.createObjectURL(blob);
			progressText = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Das Panorama konnte nicht verarbeitet werden.';
		} finally {
			processing = false;
		}
	}

	function handleFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		sourceFile = file;
		void processSelectedFile(file);
	}

	async function uploadPanorama() {
		if (!processedFile || !sourceFile || processing || uploading) return;
		if (!title.trim() || !description.trim()) {
			errorMessage = 'Titel und Beschreibung sind erforderlich.';
			return;
		}

		uploading = true;
		errorMessage = '';
		progressText = 'Panorama wird hochgeladen …';
		let originalPath = '';

		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const session = sessionData.session;
			if (!session) throw new Error('Bitte zuerst anmelden.');

			const id = crypto.randomUUID();
			originalPath = `${id}.jpg`;
			const { error: storageError } = await supabase.storage
				.from('originals')
				.upload(originalPath, processedFile, {
					contentType: 'image/jpeg',
					upsert: false
				});
			if (storageError) throw new Error(`Upload fehlgeschlagen: ${storageError.message}`);

			progressText = 'Culoca erstellt Viewer-, Galerie- und Vorschaudateien …';
			const form = new FormData();
			form.append('filename', `${id}.jpg`);
			form.append('original_path', originalPath);
			form.append('original_filename', sourceFile.name);
			form.append('title', title.trim());
			form.append('caption', caption.trim());
			form.append('description', description.trim());
			form.append('keywords', keywords.trim());
			form.append('type_id', '1');
			form.append('panorama', 'true');
			form.append('panorama_detection_source', detectionSource);
			form.append('panorama_heading_degrees', String(headingDegrees));
			form.append('exif_json', JSON.stringify(exifForUpload(exifData)));
			if (lat.trim() && lon.trim()) {
				form.append('lat', lat.trim());
				form.append('lon', lon.trim());
			}
			for (const [field, value] of [
				['country_name', source?.country_name],
				['state_name', source?.state_name],
				['region_name', source?.region_name],
				['district_name', source?.district_name],
				['municipality_name', source?.municipality_name],
				['locality_name', source?.locality_name]
			] as const) {
				if (value) form.append(field, String(value));
			}

			const response = await authFetch('/api/upload', {
				method: 'POST',
				headers: { Authorization: `Bearer ${session.access_token}` },
				body: form
			});
			const result = await response.json();
			if (!response.ok || result.status !== 'success' || !result.images?.[0]) {
				throw new Error(result.message || '360°-Upload fehlgeschlagen.');
			}

			const item = result.images[0];
			progressText = 'Fertig – Panorama wird geöffnet …';
			await goto(item.canonical_path || `/item/${item.slug}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : '360°-Upload fehlgeschlagen.';
			progressText = '';
			if (originalPath) {
				await supabase.storage.from('originals').remove([originalPath]).catch(() => undefined);
			}
		} finally {
			uploading = false;
		}
	}
</script>

<svelte:head>
	<title>360°-Panorama hochladen – Culoca</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<SiteNav />
<main class="panorama-upload">
	<header>
		<div>
			<p class="eyebrow">Culoca 360°</p>
			<h1>360°-Panorama hochladen</h1>
			<p>Das Bild wird automatisch auf höchstens 8192×4096 Pixel und maximal 45 MB optimiert.</p>
		</div>
		<a href="/upload" class="normal-upload">Normaler Foto-Upload</a>
	</header>

	{#if !loggedIn}
		<div class="notice">Für den Upload musst du angemeldet sein. <a href="/login">Jetzt anmelden</a></div>
	{/if}

	<section class="card file-card">
		<label class="drop-zone">
			<input type="file" accept="image/jpeg,image/png,image/webp" on:change={handleFile} />
			<strong>{sourceFile ? sourceFile.name : 'Equirektangulares 360°-Bild auswählen'}</strong>
			<span>Erforderlich: vollständiges 2:1-Panorama. Die Quelldatei bleibt lokal und wird vor dem Upload verkleinert.</span>
		</label>

		{#if previewUrl}
			<img src={previewUrl} alt="Flache Vorschau des ausgewählten 360°-Panoramas" class="preview" />
			<div class="facts">
				<span>{width}×{height} px</span>
				<span>{humanBytes(outputBytes)}</span>
				<span>{Math.round(outputQuality * 100)} % JPEG</span>
				<span>{detectionSource === 'xmp' ? 'GPano erkannt' : '2:1 erkannt · GPano wird ergänzt'}</span>
			</div>
		{/if}
	</section>

	<section class="card fields">
		<label>Titel<input bind:value={title} maxlength="200" /></label>
		<label>Bildunterschrift<input bind:value={caption} maxlength="240" /></label>
		<label class="wide">Beschreibung<textarea bind:value={description} rows="3" maxlength="200"></textarea></label>
		<label class="wide">Keywords<input bind:value={keywords} /></label>
		<label>Breitengrad<input bind:value={lat} inputmode="decimal" /></label>
		<label>Längengrad<input bind:value={lon} inputmode="decimal" /></label>
		<label>Blickrichtung<input bind:value={headingDegrees} type="number" min="0" max="359.999" step="0.1" /></label>
	</section>

	{#if processing || progressText}
		<div class="progress" aria-live="polite"><span class="spinner"></span>{progressText}</div>
	{/if}
	{#if errorMessage}
		<div class="error" role="alert">{errorMessage}</div>
	{/if}

	<button
		type="button"
		class="upload-button"
		disabled={!processedFile || processing || uploading || !loggedIn}
		on:click={uploadPanorama}
	>
		{uploading ? '360°-Panorama wird erstellt …' : '360°-Panorama veröffentlichen'}
	</button>
</main>
<SiteFooter />

<style>
	.panorama-upload { width: min(980px, calc(100% - 28px)); margin: 0 auto; padding: 34px 0 70px; }
	header { display: flex; justify-content: space-between; gap: 24px; align-items: end; margin-bottom: 22px; }
	h1 { margin: 2px 0 7px; font-size: clamp(1.8rem, 5vw, 3rem); }
	header p { margin: 0; color: var(--text-secondary); }
	.eyebrow { color: #ee7221; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; font-size: .75rem; }
	.normal-upload { white-space: nowrap; color: inherit; }
	.card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 14px; padding: 18px; margin-bottom: 16px; }
	.drop-zone { min-height: 145px; border: 2px dashed var(--border-color); border-radius: 11px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; cursor: pointer; }
	.drop-zone input { position: absolute; inline-size: 1px; block-size: 1px; opacity: 0; }
	.drop-zone span { max-width: 650px; color: var(--text-secondary); font-size: .9rem; }
	.preview { display: block; width: 100%; margin-top: 16px; border-radius: 9px; background: #111; }
	.facts { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
	.facts span { padding: 5px 8px; border-radius: 999px; background: var(--bg-primary); font-size: .8rem; }
	.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
	.fields label { display: grid; gap: 6px; font-size: .85rem; font-weight: 700; }
	.fields .wide { grid-column: 1 / -1; }
	input, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); padding: 10px 11px; font: inherit; }
	.notice, .progress, .error { margin: 12px 0; padding: 12px 14px; border-radius: 9px; }
	.notice, .progress { background: color-mix(in srgb, #ee7221 12%, var(--bg-secondary)); }
	.error { background: color-mix(in srgb, #c62828 16%, var(--bg-secondary)); color: #ffb4ab; }
	.progress { display: flex; align-items: center; gap: 9px; }
	.spinner { width: 17px; height: 17px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
	.upload-button { width: 100%; border: 0; border-radius: 10px; padding: 13px 18px; background: #ee7221; color: #fff; font-weight: 800; font-size: 1rem; cursor: pointer; }
	.upload-button:disabled { opacity: .5; cursor: not-allowed; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (max-width: 680px) { header { align-items: flex-start; flex-direction: column; } .fields { grid-template-columns: 1fr; } .fields .wide { grid-column: auto; } }
</style>
