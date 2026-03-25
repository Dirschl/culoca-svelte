<script lang="ts">
	export let phoneValid = true;
	export let websiteValid = true;

	export let address = '';
	export let show_address = false;
	export let phone = '';
	export let show_phone = false;
	export let email = '';
	export let show_email = false;
	export let website = '';
	export let show_website = false;
</script>

<div class="profile-section-form">
	<div class="card">
		<h3 class="section-title">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
				/>
			</svg>
			Kontakt & Info
		</h3>

		<div class="form-group">
			<label for="address">Adresse</label>
			<textarea id="address" bind:value={address} placeholder="Deine Adresse" rows="2"></textarea>
			<label class="toggle-label">
				<input type="checkbox" bind:checked={show_address} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">Adresse öffentlich anzeigen</span>
			</label>
		</div>

		<div class="form-group">
			<label for="phone">Telefonnummer</label>
			<input
				id="phone"
				type="tel"
				bind:value={phone}
				placeholder="Deine Telefonnummer"
				class:valid={phoneValid}
				class:invalid={phone.length > 0 && !phoneValid}
			/>
			{#if phone.length > 0 && !phoneValid}
				<span class="error-text">Ungültige Telefonnummer</span>
			{/if}
			<label class="toggle-label">
				<input type="checkbox" bind:checked={show_phone} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">Telefonnummer öffentlich anzeigen</span>
			</label>
		</div>

		<div class="form-group">
			<label for="email">E-Mail</label>
			<input id="email" type="email" bind:value={email} placeholder="Deine E-Mail-Adresse" />
			<label class="toggle-label">
				<input type="checkbox" bind:checked={show_email} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">E-Mail öffentlich anzeigen</span>
			</label>
		</div>

		<div class="form-group">
			<label for="website">Webseite</label>
			<input
				id="website"
				type="url"
				bind:value={website}
				placeholder="https://deine-website.de"
				class:valid={websiteValid}
				class:invalid={website.length > 0 && !websiteValid}
			/>
			{#if website.length > 0 && !websiteValid}
				<span class="error-text">URL muss mit http:// oder https:// beginnen</span>
			{/if}
			<label class="toggle-label">
				<input type="checkbox" bind:checked={show_website} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">Webseite öffentlich anzeigen</span>
			</label>
		</div>
	</div>
</div>

<style>
	@import '$lib/profile/profileSectionFormSurface.css';
</style>
