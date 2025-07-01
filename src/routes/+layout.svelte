<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';

	// Kein $props, keine runes

	// Modal-Store
	export const showUploadModal = writable(false);

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
</script>

<!-- Floating Action Button (+) nur auf der Startseite anzeigen -->
{#if $page.url.pathname === '/'}
<button class="fab-upload" on:click={() => showUploadModal.set(true)} title="Neuen Content hinzufügen">
	<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="10"/>
		<line x1="12" y1="8" x2="12" y2="16"/>
		<line x1="8" y1="12" x2="16" y2="12"/>
	</svg>
</button>
{/if}

<!-- Upload Modal -->
{#if $showUploadModal}
	<div class="modal-backdrop" on:click={() => showUploadModal.set(false)}></div>
	<div class="upload-modal">
		<div class="modal-header">
			<h2>Öffentlichen Content hinzufügen</h2>
			<button class="close-btn" on:click={() => showUploadModal.set(false)}>&times;</button>
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
	.fab-upload {
		position: fixed;
		right: 1.5rem;
		bottom: 17.5rem;
		z-index: 100;
		width: 56px;
		height: 56px;
		background: #0066cc;
		color: #fff;
		border-radius: 50%;
		border: none;
		box-shadow: 0 4px 16px rgba(0,0,0,0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		cursor: pointer;
		transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
	}
	.fab-upload:hover {
		background: #0052a3;
		transform: scale(1.08);
	}
	.modal-backdrop {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.5);
		z-index: 101;
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
		.fab-upload {
			right: 1rem;
			bottom: 13.5rem;
			width: 48px;
			height: 48px;
			font-size: 1.2rem;
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
