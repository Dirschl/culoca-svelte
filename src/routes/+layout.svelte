<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';
	import { showPublicContentModal } from '$lib/modalStore';

	// Kein $props, keine runes

	// Login-Status
	let isLoggedIn = false;

	// Klassische Svelte 4 States
	let title = '';
	let desc = '';
	let keywords = '';

	$: titleValid = title.length >= 40 && title.length <= 60;
	$: titleTooShort = title.length > 0 && title.length < 40;
	$: titleTooLong = title.length > 60;
	$: titleRemaining = 60 - title.length;

	$: descValid = desc.length >= 120 && desc.length <= 160;
	$: descTooShort = desc.length > 0 && desc.length < 120;
	$: descTooLong = desc.length > 160;
	$: descRemaining = 160 - desc.length;

	$: keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
	$: keywordsValid = keywordList.length >= 5 && keywordList.length <= 50;
	$: keywordsTooFew = keywordList.length > 0 && keywordList.length < 5;
	$: keywordsTooMany = keywordList.length > 50;
	$: keywordsRemaining = 50 - keywordList.length;

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		isLoggedIn = !!user;
		
		// Setze Culoca SVG Favicon für alle Seiten außer Detailseiten
		// Detailseiten (/item/[id]) haben ihr eigenes dynamisches Favicon
		if (!$page.route.id?.includes('/item/[id]')) {
			// Entferne alle bestehenden Favicon-Links (außer die vom Server gesetzten)
			const existingFavicons = document.querySelectorAll('link[rel="icon"]:not([data-static])');
			existingFavicons.forEach(link => link.remove());
			
			// Füge das neue Culoca SVG Favicon hinzu (moderne Browser)
			const svgFaviconLink = document.createElement('link');
			svgFaviconLink.rel = 'icon';
			svgFaviconLink.type = 'image/svg+xml';
			svgFaviconLink.href = '/culoca-favicon.svg';
			document.head.appendChild(svgFaviconLink);
			
			// Füge PNG Fallback hinzu (ältere Browser)
			const pngFaviconLink = document.createElement('link');
			pngFaviconLink.rel = 'icon';
			pngFaviconLink.type = 'image/png';
			pngFaviconLink.href = '/culoca-icon.png';
			document.head.appendChild(pngFaviconLink);
		}
	});
</script>



<!-- Upload Modal -->
{#if $showPublicContentModal}
	<div 
		class="modal-backdrop" 
		role="button"
		tabindex="0"
		on:click={() => showPublicContentModal.set(false)}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
				e.preventDefault();
				showPublicContentModal.set(false);
			}
		}}
		aria-label="Modal schließen"
	></div>
	<div class="upload-modal">
		<div class="modal-header">
			<h2>Öffentlichen Content hinzufügen</h2>
			<button class="close-btn" on:click={() => showPublicContentModal.set(false)}>&times;</button>
		</div>
		<div class="modal-body">
			<!-- Content-Typ Dropdown -->
			<label for="content-type">Typ</label>
			<select id="content-type">
				<option>Foto</option>
				<option>Textbeitrag</option>
				<option>Veranstaltung</option>
				<option>Direct Link</option>
			</select>
			<!-- Felder für Foto (Minimal) -->
			<label for="title">Titel</label>
			<input id="title" type="text" maxlength="60" placeholder="Titel (min. 40, max. 60 Zeichen)"
				bind:value={title}
				class:title-valid={titleValid}
				class:title-error={titleTooLong}
				class:title-success={titleValid && !titleTooLong}
			/>
			<div class="char-counter">
				{#if titleTooShort}
					<span>{40 - title.length} Zeichen bis Minimum</span>
				{:else if titleTooLong}
					<span class="error">{title.length - 60} Zeichen zu viel</span>
				{:else}
					<span>{titleRemaining} Zeichen übrig</span>
				{/if}
			</div>
			<label for="desc">Beschreibung</label>
			<textarea id="desc" maxlength="160" placeholder="Beschreibung (min. 120, max. 160 Zeichen)"
				bind:value={desc}
				class:desc-valid={descValid}
				class:desc-error={descTooLong}
				class:desc-success={descValid && !descTooLong}
			></textarea>
			<div class="char-counter">
				{#if descTooShort}
					<span>{120 - desc.length} Zeichen bis Minimum</span>
				{:else if descTooLong}
					<span class="error">{desc.length - 160} Zeichen zu viel</span>
				{:else}
					<span>{descRemaining} Zeichen übrig</span>
				{/if}
			</div>
			<label for="keywords">Keywords</label>
			<input id="keywords" type="text" maxlength="300" placeholder="Keywords, kommasepariert (min. 5, max. 50)"
				bind:value={keywords}
				class:keywords-valid={keywordsValid}
				class:keywords-error={keywordsTooMany}
				class:keywords-success={keywordsValid && !keywordsTooMany}
			/>
			<div class="char-counter">
				{#if keywordsTooFew}
					<span>{5 - keywordList.length} Keywords bis Minimum</span>
				{:else if keywordsTooMany}
					<span class="error">{keywordList.length - 50} zu viele Keywords</span>
				{:else}
					<span>{keywordsRemaining} Keywords übrig</span>
				{/if}
			</div>
			<label for="file">Foto</label>
			<input id="file" type="file" accept="image/jpeg,image/png,image/webp" />
			<!-- Platz für weitere Felder je nach Typ -->
		</div>
		<div class="modal-footer">
			<button class="upload-btn">Content hochladen</button>
		</div>
	</div>
{/if}

<style>

	.modal-backdrop {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.5);
		z-index: 101;
		cursor: pointer;
	}
	.modal-backdrop:focus {
		outline: 2px solid #0066cc;
		outline-offset: -2px;
	}
	.upload-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: #181a20;
		color: #fff;
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(0,0,0,0.25);
		z-index: 102;
		width: 95vw;
		max-width: 420px;
		padding: 2rem 1.5rem 1.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	@media (max-width: 600px) {
		.upload-modal {
			width: 100vw;
			height: 100vh;
			max-width: none;
			max-height: none;
			border-radius: 0;
			padding: 1.2rem 0.5rem 0.5rem 0.5rem;
			top: 0;
			left: 0;
			transform: none;
		}

	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.close-btn {
		background: none;
		border: none;
		color: #fff;
		font-size: 2rem;
		cursor: pointer;
		line-height: 1;
		padding: 0 0.5rem;
	}
	.modal-body label {
		margin-top: 0.7rem;
		font-size: 1rem;
		font-weight: 500;
		color: #fff;
		display: block;
	}
	.modal-body input[type="text"],
	.modal-body textarea,
	.modal-body select {
		width: 100%;
		padding: 0.6rem 0.9rem;
		border: 1.5px solid #2d2d44;
		border-radius: 6px;
		background: #23242a;
		color: #fff;
		font-size: 1rem;
		margin-bottom: 0.5rem;
		transition: border-color 0.2s, box-shadow 0.2s;
		outline: none;
		box-sizing: border-box;
	}
	.modal-body input[type="text"]:focus,
	.modal-body textarea:focus,
	.modal-body select:focus {
		border-color: #0066cc;
		box-shadow: 0 0 0 2px #0066cc33;
		background: #232b3a;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		margin-top: 1rem;
	}
	.upload-btn {
		background: #0066cc;
		color: #fff;
		border: none;
		border-radius: 6px;
		padding: 0.8rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}
	.upload-btn:hover {
		background: #0052a3;
	}
	.char-counter {
		font-size: 0.92rem;
		color: #aaa;
		margin-bottom: 0.2rem;
		margin-top: -0.3rem;
		min-height: 1.2em;
	}
	.char-counter .error {
		color: #ff4d4f;
		font-weight: 500;
	}
	input.title-valid,
	textarea.desc-valid,
	input.keywords-valid {
		border-color: #28a745;
	}
	input.title-error,
	textarea.desc-error,
	input.keywords-error {
		border-color: #ff4d4f;
	}
	input.title-success,
	textarea.desc-success,
	input.keywords-success {
		border-color: #28a745;
		box-shadow: 0 0 0 2px #28a74533;
	}
</style>

<slot />
