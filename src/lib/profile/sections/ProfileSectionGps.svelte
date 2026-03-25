<script lang="ts">
	export let homeLat = '';
	export let homeLon = '';
	export let gpsEmail = '';
	export let gpsTrackingEnabled = false;
	export let gpxExportEnabled = false;
	export let lastDataShareEnabled = false;
</script>

<div class="profile-section-form">
	<div class="card">
		<h3 class="section-title">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
				/>
			</svg>
			GPS-Tracking & Home Base
		</h3>

		<div class="form-group">
			<label for="home-lat">Home Base - Breitengrad</label>
			<input
				id="home-lat"
				type="number"
				step="0.000001"
				bind:value={homeLat}
				placeholder="48.31934"
			/>
			<span class="help-text">Deine Standard-Position für GPS-basierte Funktionen</span>
		</div>

		<div class="form-group">
			<label for="home-lon">Home Base - Längengrad</label>
			<input
				id="home-lon"
				type="number"
				step="0.000001"
				bind:value={homeLon}
				placeholder="12.71849"
			/>
			<span class="help-text">Deine Standard-Position für GPS-basierte Funktionen</span>
		</div>

		<div class="form-group">
			<label for="gps-email">GPS-Email für Track-Export</label>
			<input
				id="gps-email"
				type="email"
				bind:value={gpsEmail}
				placeholder="deine-email@example.com"
			/>
			<span class="help-text">Email-Adresse für automatischen Track-Versand</span>
		</div>

		<div class="gps-settings">
			<h4>GPS-Tracking Einstellungen</h4>

			<label class="toggle-label">
				<input type="checkbox" bind:checked={gpsTrackingEnabled} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">GPS-Tracking aktivieren</span>
			</label>
			<span class="help-text">Erlaubt die Aufzeichnung von GPS-Tracks für Touren</span>

			<label class="toggle-label">
				<input type="checkbox" bind:checked={gpxExportEnabled} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">GPX-Export per Email aktivieren</span>
			</label>
			<span class="help-text">Erlaubt das Senden von GPS-Tracks per Email</span>

			<label class="toggle-label">
				<input type="checkbox" bind:checked={lastDataShareEnabled} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">Letzte GPS-Daten teilen</span>
			</label>
			<span class="help-text">Teilt deine letzte bekannte Position für bessere Navigation</span>
		</div>

		<div class="gps-explanation">
			<p class="help-text">
				<strong>Home Base:</strong> Diese Koordinaten werden als Fallback verwendet, wenn keine aktuelle
				GPS-Position verfügbar ist. Sie verbessern die Performance der Galerie und Navigation.
			</p>
			<p class="help-text">
				<strong>GPS-Tracking:</strong> Ermöglicht die Aufzeichnung von Touren und Routen direkt in der App.
				Alle Daten werden lokal gespeichert und können exportiert werden.
			</p>
		</div>
	</div>
</div>

<style>
	@import '$lib/profile/profileSectionFormSurface.css';
</style>
