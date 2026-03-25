<script lang="ts">
	export let privacy_mode = 'public';
</script>

<div class="profile-section-form">
	<div class="card">
		<h3 class="section-title">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
			</svg>
			Privatsphäre-Einstellungen
		</h3>
		<div class="form-group">
			<label for="privacy-mode">Permalink-Verhalten</label>
			<select id="privacy-mode" bind:value={privacy_mode}>
				<option value="public"
					>Public - Jeder kann dein Profil sehen und Filter entfernen</option
				>
				<option value="closed">Closed - User können nur dein Profil sehen</option>
				<option value="private">Private - Nur du kannst dein Profil sehen</option>
				<option value="all">All - Besucher sehen alle Inhalte ohne Filter</option>
			</select>
			<div class="privacy-explanation">
				{#if privacy_mode === 'public'}
					<p class="help-text">
						<strong>Public:</strong> Dein Permalink zeigt nur deine Bilder an. Besucher können den Filter
						entfernen, um alle Bilder zu sehen.
					</p>
				{:else if privacy_mode === 'closed'}
					<p class="help-text">
						<strong>Closed:</strong> Dein Permalink zeigt nur deine Bilder an. Besucher können den Filter
						nicht entfernen - sie sehen nur deine Inhalte.
					</p>
				{:else if privacy_mode === 'private'}
					<p class="help-text">
						<strong>Private:</strong> So nimmst du sofort alle Bilder aus der Sichtbarkeit, Detailseite wird
						umgeleitet.
					</p>
				{:else if privacy_mode === 'all'}
					<p class="help-text">
						<strong>All:</strong> Dein Permalink zeigt alle Bilder der Plattform an. Besucher sehen die
						komplette Culoca-Galerie.
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	@import '$lib/profile/profileSectionFormSurface.css';
</style>
