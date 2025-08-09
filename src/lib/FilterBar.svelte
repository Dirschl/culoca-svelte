<script lang="ts">
	import { filterStore, userFilter, locationFilter, hasActiveFilters } from './filterStore';
	import { 
		sessionStore, 
		customerBranding, 
		activeUserFilter, 
		shouldShowCustomerBranding, 
		isDuplicateDisplay 
	} from './sessionStore';
	import { browser } from '$app/environment';
	import { X } from 'lucide-svelte';
	import { resetGallery } from './galleryStore';


	export let showOnMap = false; // Different styling for map vs gallery
	// GPS coordinates from filterStore instead of props
	$: userLat = $filterStore.lastGpsPosition?.lat ?? null;
	$: userLon = $filterStore.lastGpsPosition?.lon ?? null;
	export let isPermalinkMode = false; // Enable clickable filter names for detail navigation
	export let permalinkImageId: string | null = null;
	// Props removed as they are not used in the component
	// GPS status from filterStore instead of props
	$: gpsStatus = $filterStore.gpsAvailable ? 'active' : 'none';
	$: lastGPSUpdateTime = $filterStore.lastGpsPosition?.timestamp ?? null;
	export let isManual3x3Mode = false;
	// Original gallery coordinates from filterStore instead of props
	$: originalGalleryLat = $filterStore.lastGpsPosition?.lat ?? null;
	$: originalGalleryLon = $filterStore.lastGpsPosition?.lon ?? null;
	export let onLocationFilterClear: (() => void) | undefined = undefined; // New callback for location filter clearing
	
	let cachedLat: number | null = null;
	let cachedLon: number | null = null;
	

	
	// Reactive GPS status info
	$: gpsStatusInfo = (() => {
		try {
			return getGPSStatusText();
		} catch (error) {
			console.error('Error in gpsStatusInfo reactive:', error);
			return { text: '', isStale: false };
		}
	})();
	
	// Check for cached GPS coordinates in localStorage
	if (browser) {
		const cached = localStorage.getItem('lastKnownPosition');
		if (cached) {
			try {
				const position = JSON.parse(cached);
				cachedLat = position.lat;
				cachedLon = position.lon;
			} catch (e) {
				// Ignore parsing errors
			}
		}
	}
	

	
	// Sorting method removed - we always sort by distance when possible
	
	// Format coordinates for display in decimal format
	function formatCoordinates(lat: number, lon: number): string {
		return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
	}
	
	// Function to get GPS status with last update time
	function getGPSStatusText(): { text: string; isStale: boolean } {
		try {
			if (gpsStatus === 'active' && lastGPSUpdateTime) {
				const timeDiff = Date.now() - lastGPSUpdateTime;
				const seconds = Math.floor(timeDiff / 1000);
				
				// Only show time if GPS is stale (more than 5 seconds old)
				if (seconds > 5) {
					const minutes = Math.floor(seconds / 60);
					const remainingSeconds = seconds % 60;
					
					let text = '';
					if (minutes > 0) {
						text = `${minutes}m ${remainingSeconds}s`;
					} else {
						text = `${remainingSeconds}s`;
					}
					
					return { text, isStale: true };
				}
			}
		} catch (error) {
			console.error('Error in getGPSStatusText:', error);
		}
		return { text: '', isStale: false };
	}
	
	// Customer branding display (from session store)
	$: customerBrandInfo = $shouldShowCustomerBranding && $customerBranding && !$isDuplicateDisplay ? {
		avatarUrl: getAvatarUrl($customerBranding.avatarUrl),
		name: $customerBranding.fullName,
		accountName: $customerBranding.accountName,
		canRemove: $customerBranding.privacyMode !== 'private' && $customerBranding.privacyMode !== 'closed'
	} : null;

	// Helper function to get correct avatar URL
	function getAvatarUrl(avatarUrl: string | undefined): string | null {
		if (!avatarUrl) return null;
		if (avatarUrl.startsWith('http')) {
			return avatarUrl; // External URL (e.g., Google avatar)
		} else {
			return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
		}
	}

	// Active user filter display (from session store)
	$: userFilterInfo = $activeUserFilter ? {
		avatarUrl: getAvatarUrl($activeUserFilter.avatarUrl),
		name: $activeUserFilter.username,
		accountName: $activeUserFilter.accountName,
		canRemove: $customerBranding?.privacyMode !== 'private' && $customerBranding?.privacyMode !== 'closed'
	} : null;
</script>

<!-- Show filter bar when customer branding should be shown, when other filters are present, or always show Culoca logo -->
{#if customerBrandInfo || userFilterInfo || $locationFilter || gpsStatus !== 'none' || $userFilter || true}
	<div class="filter-bar {showOnMap ? 'map-style' : ''}">
		<div class="filter-container">
			<!-- Left Side: Avatar/Logo and Name - Only show one at a time -->
			<div class="left-section">
				<!-- Priority 1: Active User Filter Display (from session store) -->
				{#if userFilterInfo}
					<div class="user-filter">
						{#if userFilterInfo.avatarUrl}
							<img 
								src={userFilterInfo.avatarUrl} 
								alt={userFilterInfo.name}
								class="user-avatar"
							/>
						{:else}
							<div class="user-avatar-placeholder">
								{userFilterInfo.name.charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="user-name" class:clickable={isPermalinkMode} on:click={() => isPermalinkMode && permalinkImageId && (() => { const url = new URL(`/item/${permalinkImageId}`, window.location.origin); window.location.href = url.toString(); })()}>
							{userFilterInfo.name}
						</span>
						<!-- Show X button if removal is allowed -->
						{#if userFilterInfo.canRemove}
							<button 
								class="remove-filter"
								on:click={() => sessionStore.clearActiveUserFilter()}
								aria-label="User-Filter entfernen"
							>
								<X size={14} />
							</button>
						{/if}
					</div>
				<!-- Priority 2: User Filter Display (from filterStore) -->
				{:else if $userFilter}
					<div class="user-filter">
						{#if $userFilter.avatarUrl}
							<img 
								src={getAvatarUrl($userFilter.avatarUrl)} 
								alt={$userFilter.username}
								class="user-avatar"
							/>
						{:else}
							<div class="user-avatar-placeholder">
								{$userFilter.username.charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="user-name" class:clickable={isPermalinkMode} on:click={() => isPermalinkMode && permalinkImageId && (() => { const url = new URL(`/item/${permalinkImageId}`, window.location.origin); window.location.href = url.toString(); })()}>
							{$userFilter.accountName || $userFilter.username}
						</span>
						<button 
							class="remove-filter"
							on:click={() => filterStore.clearUserFilter()}
							aria-label="User-Filter entfernen"
						>
							<X size={14} />
						</button>
					</div>
				<!-- Priority 3: Customer Brand Display (persistent session-based) -->
				{:else if customerBrandInfo}
					<div class="customer-brand">
						{#if customerBrandInfo.avatarUrl}
							<img 
								src={customerBrandInfo.avatarUrl} 
								alt={customerBrandInfo.name}
								class="customer-avatar"
							/>
						{:else}
							<div class="customer-avatar-placeholder">
								{customerBrandInfo.name.charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="customer-name" class:clickable={isPermalinkMode} on:click={() => isPermalinkMode && permalinkImageId && (() => { const url = new URL(`/item/${permalinkImageId}`, window.location.origin); window.location.href = url.toString(); })()}>
							{customerBrandInfo.name}
						</span>
						<!-- Show X button if removal is allowed -->
						{#if customerBrandInfo.canRemove}
							<button 
								class="remove-filter"
								on:click={() => sessionStore.clearCustomerBranding()}
								aria-label="Customer-Branding entfernen"
							>
								<X size={14} />
							</button>
						{/if}
					</div>
				<!-- Priority 4: Culoca Logo (when no other filters are active) -->
				{:else}
					<a href="/web" class="culoca-logo">
						<svg class="culoca-logo-img" id="Ebene_1" data-name="Ebene 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 473.74 100.88">
							<defs>
								<style>
									.cls-1 {
										fill: var(--text-primary, #fff);
									}
									.cls-2 {
										fill: #ee7221;
									}
								</style>
							</defs>
							<path class="cls-1" d="m0,41.35c0-6.3,1.12-11.99,3.35-17.07,2.24-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
							<path class="cls-1" d="m114.95,82.71c-5.03,0-9.58-.63-13.66-1.89-4.07-1.26-7.55-3.15-10.42-5.67-2.88-2.52-5.09-5.71-6.65-9.57s-2.34-8.39-2.34-13.59V1.89h25.52v49.04c0,2.76.58,4.87,1.74,6.32,1.16,1.46,3.09,2.19,5.81,2.19s4.65-.73,5.81-2.19c1.16-1.46,1.74-3.56,1.74-6.32V1.89h25.64v50.1c0,5.2-.78,9.73-2.34,13.59s-3.79,7.05-6.71,9.57c-2.92,2.52-6.41,4.41-10.48,5.67-4.07,1.26-8.63,1.89-13.66,1.89Z"/>
							<path class="cls-1" d="m165.07,1.89h26.6v58.13h22.04v20.68h-48.64V1.89Z"/>
							<path class="cls-2" d="m221.15,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07Zm25.16,0c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
							<path class="cls-1" d="m315.86,41.35c0-6.3,1.12-11.99,3.36-17.07,2.23-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
							<path class="cls-1" d="m424.26,1.89h19.17l30.31,78.81h-25.16l-2.64-7.09h-24.2l-2.64,7.09h-25.16L424.26,1.89Zm14.97,54.35l-5.39-13.83-5.39,13.83h10.78Z"/>
						</svg>
					</a>
				{/if}
			</div>

			<!-- Right Side: Location Filter, GPS Status -->
			<div class="right-section">

				<!-- Location Filter OR GPS Status -->
				{#if $locationFilter}
					<div class="location-filter">
						<!-- Culoca O Icon SVG -->
						<svg width="18" height="18" viewBox="0 0 83.86 100.88" fill="currentColor" class="location-icon">
							<path d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
						</svg>
						<span class="location-name" 
							on:click={() => {
								console.log('[FilterBar] Location filter clear clicked');
								console.log('[FilterBar] isPermalinkMode:', isPermalinkMode);
								console.log('[FilterBar] permalinkImageId:', permalinkImageId);
								console.log('[FilterBar] isManual3x3Mode:', isManual3x3Mode);
								
								if (isPermalinkMode && permalinkImageId) {
									        // Use SvelteKit navigation
        if (typeof window !== 'undefined') {
          window.location.href = `/item/${permalinkImageId}`;
        }
								} else {
									console.log('[FilterBar] Clearing location filter');
									filterStore.clearLocationFilter();
									resetGallery();
									
									// Rufe Callback auf um Galerie neu zu laden
									if (onLocationFilterClear) {
										console.log('[FilterBar] Calling onLocationFilterClear callback');
										onLocationFilterClear();
									} else {
										console.log('[FilterBar] No onLocationFilterClear callback provided');
									}
								}
							}}
							title="Filter entfernen"
						>
							{$locationFilter.name}
						</span>
					</div>
				{:else if userLat !== null && userLon !== null}
					<div class="gps-status active">
						<button class="gps-coords-clickable" on:click={() => {
							console.log('🎯 GPS-Koordinaten geklickt!');
							
							// Location-Filter entfernen falls vorhanden
							filterStore.clearLocationFilter();
							
							// Frische GPS-Koordinaten anfordern falls nötig
							if (navigator.geolocation) {
								navigator.geolocation.getCurrentPosition(
									(position) => {
										const { latitude, longitude } = position.coords;
										console.log('[FilterBar] Got fresh GPS coordinates for mobile mode:', { latitude, longitude });
										
										// GPS-Status und Koordinaten aktualisieren
										filterStore.updateGpsStatus(true, { lat: latitude, lon: longitude });
										
										// In den mobilen Modus wechseln
										window.dispatchEvent(new CustomEvent('toggle3x3Mode'));
									},
									(error) => {
										console.warn('[FilterBar] Failed to get fresh GPS for mobile mode:', error);
										// Trotzdem in den mobilen Modus wechseln mit vorhandenen Daten
										window.dispatchEvent(new CustomEvent('toggle3x3Mode'));
									},
									{
										enableHighAccuracy: true,
										timeout: 10000,
										maximumAge: 0 // Immer frische Daten anfordern
									}
								);
							} else {
								// Fallback: Direkt in den mobilen Modus wechseln
								window.dispatchEvent(new CustomEvent('toggle3x3Mode'));
							}
						}}>
							{#if gpsStatusInfo && gpsStatusInfo.text}
								<span class="gps-time {gpsStatusInfo.isStale ? 'stale' : ''}">
									{gpsStatusInfo.text}
								</span>
							{/if}
							<span class="gps-coords">
								{formatCoordinates(userLat, userLon)}
							</span>
						</button>
						{#if !isManual3x3Mode && originalGalleryLat && originalGalleryLon}
							<div class="original-gps-coords" 
								on:click={() => {
									console.log('[FilterBar] Original GPS coords clicked - updating GPS then reloading');
									
									// Location-Filter löschen
									filterStore.clearLocationFilter();
									
									// GPS-Daten aus localStorage löschen, um Überschreiben zu verhindern
									filterStore.clearGpsData();
									
									// Aktuelle GPS-Koordinaten vom Browser anfordern und setzen
									if (navigator.geolocation) {
										navigator.geolocation.getCurrentPosition(
											(position) => {
												const { latitude, longitude } = position.coords;
												console.log('[FilterBar] Got fresh GPS coordinates:', { latitude, longitude });
												
												// GPS-Status und Koordinaten aktualisieren
												filterStore.updateGpsStatus(true, { lat: latitude, lon: longitude });
												
												// Kurze Verzögerung für Store-Update, dann Seite neu laden
												setTimeout(() => {
													console.log('[FilterBar] Reloading page with fresh GPS coordinates');
													window.location.href = window.location.href;
												}, 100);
											},
											(error) => {
												console.warn('[FilterBar] Failed to get fresh GPS:', error);
												// Fallback: Seite trotzdem neu laden
												window.location.href = window.location.href;
											},
											{
												enableHighAccuracy: true,
												timeout: 10000,
												maximumAge: 0 // Immer frische Daten anfordern
											}
										);
									} else {
										// Fallback wenn Geolocation nicht verfügbar
										window.location.href = window.location.href;
									}
								}}
								title="Aktuelle GPS-Koordinaten aktualisieren"
							>
								{formatCoordinates(originalGalleryLat, originalGalleryLon)}
							</div>
						{/if}
					</div>
				{:else}
					<div class="gps-status none">
						<button class="gps-map-link" on:click={() => window.dispatchEvent(new CustomEvent('openMap'))}>
							Standort auswählen
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.filter-bar {
		padding: 4px 0;
		margin-bottom: 2px;
		height: 80px;
		display: flex;
		align-items: center;
	}

	.filter-bar.map-style {
		position: absolute;
		top: 16px;
		left: 16px;
		right: 16px;
		z-index: 1000;
		margin-bottom: 0;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-radius: 8px;
		padding: 8px 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		height: 80px;
	}

	.filter-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 2px 2rem;
		width: 100%;
		height: 100%;
	}

	.left-section {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: center;
	}

	.right-section {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: center;
	}

	/* Sorting method display removed - simplified interface */

	/* Customer Brand Styling - Matching user avatar size */
	.customer-brand {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--text-primary, #1f2937);
		font-weight: 500;
		font-size: 16px;
	}

	:global(.dark) .customer-brand {
		color: var(--text-primary, #f9fafb);
	}

	.customer-avatar {
		height: 64px;
		border-radius: 50%;
		object-fit: cover;
	}

	.customer-avatar-placeholder {
		height: 64px;
		width: 64px;
		border-radius: 50%;
		background: var(--bg-secondary, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 24px;
		color: var(--text-secondary, #6b7280);
	}

	:global(.dark) .customer-avatar-placeholder {
		background: var(--bg-secondary, #374151);
		color: var(--text-secondary, #9ca3af);
	}

	/* User Filter Styling - Same size as customer brand */
	.user-filter {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--text-primary, #1f2937);
		font-weight: 500;
		font-size: 16px;
	}

	:global(.dark) .user-filter {
		color: var(--text-primary, #f9fafb);
	}

	.user-avatar {
		height: 64px;
		border-radius: 50%;
		object-fit: cover;
	}

	.user-avatar-placeholder {
		height: 64px;
		width: 64px;
		border-radius: 50%;
		background: var(--bg-secondary, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 24px;
		color: var(--text-secondary, #6b7280);
	}

	:global(.dark) .user-avatar-placeholder {
		background: var(--bg-secondary, #374151);
		color: var(--text-secondary, #9ca3af);
	}

	/* Location Filter Styling - Theme-aware */
	.location-filter {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-primary, #1f2937);
		font-weight: 500;
		font-size: 16px;
	}

	:global(.dark) .location-filter {
		color: var(--text-primary, #f9fafb);
	}

	.location-icon {
		font-size: 18px;
	}

	.location-name {
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.location-name:hover {
		color: var(--culoca-orange, #ee7221);
	}



	/* GPS Status Styling - Theme-aware with different states */
	.gps-status {
		font-weight: 500;
		font-size: 16px;
	}

	/* Active GPS - Theme-aware */
	.gps-status.active {
		color: var(--text-primary, #1f2937);
	}

	:global(.dark) .gps-status.active {
		color: var(--text-primary, #f9fafb);
	}

	/* Cached GPS - Theme-aware */
	.gps-status.cached {
		color: var(--text-primary, #1f2937);
	}

	:global(.dark) .gps-status.cached {
		color: var(--text-primary, #f9fafb);
	}

	/* Checking GPS - Theme-aware */
	.gps-status.checking {
		color: var(--text-primary, #1f2937);
	}

	:global(.dark) .gps-status.checking {
		color: var(--text-primary, #f9fafb);
	}

	/* Denied GPS - Theme-aware */
	.gps-status.denied {
		color: var(--text-primary, #1f2937);
	}

	:global(.dark) .gps-status.denied {
		color: var(--text-primary, #f9fafb);
	}

	/* Unavailable GPS - Theme-aware */
	.gps-status.unavailable {
		color: var(--text-primary, #1f2937);
	}

	:global(.dark) .gps-status.unavailable {
		color: var(--text-primary, #f9fafb);
	}

	/* GPS Map Link Button */
	.gps-map-link {
		background: none;
		border: none;
		color: var(--text-secondary, #6b7280);
		font-size: 16px;
		font-weight: 500;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		margin: 0;
	}

	.gps-map-link:hover {
		color: var(--culoca-orange, #ee7221);
	}

	/* No GPS - Theme-aware */
	.gps-status.none {
		color: var(--text-primary, #1f2937);
	}

	:global(.dark) .gps-status.none {
		color: var(--text-primary, #f9fafb);
	}

	.gps-coords-clickable {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		display: flex;
		gap: 8px;
	}

	.gps-coords-clickable:hover {
		background: var(--bg-hover, rgba(0, 0, 0, 0.05));
	}

	:global(.dark) .gps-coords-clickable:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.05));
	}

	.gps-coords {
	}

	.gps-time {
		font-size: 14px;
		font-weight: 400;
		opacity: 0.8;
		margin-left: 8px;
	}
	
	.gps-time.stale {
		color: var(--culoca-orange, #ee7221);
		font-weight: 500;
		opacity: 1;
	}

	.gps-text {
		font-weight: 500;
	}

	/* Remove Button Styling - Larger for better usability */
	.remove-filter {
		background: none;
		border: none;
		color: var(--text-muted, #9ca3af);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s;
		margin-left: 8px;
	}

	.remove-filter:hover {
		color: var(--text-secondary, #6b7280);
		background: var(--bg-hover, rgba(0, 0, 0, 0.05));
	}

	:global(.dark) .remove-filter {
		color: var(--text-muted, #6b7280);
	}

	:global(.dark) .remove-filter:hover {
		color: var(--text-secondary, #9ca3af);
		background: var(--bg-hover, rgba(255, 255, 255, 0.05));
	}

	/* Clickable filter names in permalink mode */
	.clickable {
		cursor: pointer;
		transition: color 0.2s ease;
		text-decoration: underline;
		text-decoration-color: transparent;
	}

	.clickable:hover {
		color: var(--culoca-orange, #ee7221);
		text-decoration-color: var(--culoca-orange, #ee7221);
	}

	/* Culoca Logo Styling - Theme-aware */
	.culoca-logo {
		display: flex;
		align-items: center;
		margin-top: 4px;
	}

	.culoca-logo-img {
		height: 32px;
		width: auto;
	}
	


	/* Ursprüngliche GPS-Koordinaten in Orange - Klickbar */
	.original-gps-coords {
		color: #ee7221; /* Culoca Orange */
		cursor: pointer;
		transition: color 0.2s ease;
		padding: 4px;
		border-radius: 4px;
	}

	.original-gps-coords:hover {
		color: #d65a1a; /* Dunkleres Orange beim Hover */
		background: var(--bg-hover, rgba(238, 114, 33, 0.1));
	}
</style> 