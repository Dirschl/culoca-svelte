<script lang="ts">
	import { filterStore, userFilter, locationFilter, hasActiveFilters } from './filterStore';
	import { 
		sessionStore, 
		customerBranding, 
		activeUserFilter, 
		shouldShowCustomerBranding, 
		isDuplicateDisplay 
	} from './sessionStore';
	import { X } from 'lucide-svelte';
	import { browser } from '$app/environment';

	export let showOnMap = false; // Different styling for map vs gallery
	export let userLat: number | null = null;
	export let userLon: number | null = null;
	export let isPermalinkMode = false; // Enable clickable filter names for detail navigation
	export let permalinkImageId: string | null = null;
	export let showDistance = false; // New prop to show current sorting method
	export let isLoggedIn = false; // New prop to determine if user is logged in
	
	// GPS status tracking
	let gpsStatus: 'active' | 'cached' | 'none' = 'none';
	let cachedLat: number | null = null;
	let cachedLon: number | null = null;
	
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
	
	// Determine GPS status
	$: {
		if (userLat !== null && userLon !== null) {
			gpsStatus = 'active';
			// Store current position as cached
			if (browser) {
				localStorage.setItem('lastKnownPosition', JSON.stringify({
					lat: userLat,
					lon: userLon,
					timestamp: Date.now()
				}));
			}
		} else if (cachedLat !== null && cachedLon !== null) {
			gpsStatus = 'cached';
		} else {
			gpsStatus = 'none';
		}
	}
	
	// Sorting method removed - we always sort by distance when possible
	
	// Format coordinates for display in decimal format
	function formatCoordinates(lat: number, lon: number): string {
		return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
	}
	
	// Customer branding display (from session store)
	$: customerBrandInfo = $shouldShowCustomerBranding && $customerBranding && !$isDuplicateDisplay ? {
		avatarUrl: $customerBranding.avatarUrl,
		name: $customerBranding.fullName,
		accountName: $customerBranding.accountName,
		canRemove: $customerBranding.privacyMode !== 'private' && $customerBranding.privacyMode !== 'closed'
	} : null;

	// Active user filter display (from session store)
	$: userFilterInfo = $activeUserFilter ? {
		avatarUrl: $activeUserFilter.avatarUrl,
		name: $activeUserFilter.username,
		accountName: $activeUserFilter.accountName,
		canRemove: $customerBranding?.privacyMode !== 'private' && $customerBranding?.privacyMode !== 'closed'
	} : null;
</script>

<!-- Show filter bar when customer branding should be shown or when other filters are present -->
{#if customerBrandInfo || userFilterInfo || $locationFilter || gpsStatus !== 'none' || $userFilter}
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
						<span class="user-name" class:clickable={isPermalinkMode} on:click={() => isPermalinkMode && permalinkImageId && (window.location.href = `/item/${permalinkImageId}`)}>
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
								src={$userFilter.avatarUrl} 
								alt={$userFilter.username}
								class="user-avatar"
							/>
						{:else}
							<div class="user-avatar-placeholder">
								{$userFilter.username.charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="user-name" class:clickable={isPermalinkMode} on:click={() => isPermalinkMode && permalinkImageId && (window.location.href = `/item/${permalinkImageId}`)}>
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
						<span class="customer-name" class:clickable={isPermalinkMode} on:click={() => isPermalinkMode && permalinkImageId && (window.location.href = `/item/${permalinkImageId}`)}>
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
				{/if}
			</div>

			<!-- Right Side: Location Filter, GPS Status -->
			<div class="right-section">

				<!-- Location Filter OR GPS Status -->
				{#if $locationFilter}
					<div class="location-filter">
						<span class="location-icon">📍</span>
						<span class="location-name" class:clickable={isPermalinkMode} on:click={() => isPermalinkMode && permalinkImageId && (window.location.href = `/item/${permalinkImageId}`)}>{$locationFilter.name}</span>
						<button 
							class="remove-filter"
							on:click={() => filterStore.clearLocationFilter()}
							aria-label="Standort-Filter entfernen"
						>
							<X size={14} />
						</button>
					</div>
				{:else if gpsStatus === 'active' && userLat !== null && userLon !== null}
					<div class="gps-status active">
						<span class="gps-coords">
							{formatCoordinates(userLat, userLon)}
						</span>
					</div>
				{:else if gpsStatus === 'cached' && cachedLat !== null && cachedLon !== null}
					<div class="gps-status cached">
						<span class="gps-coords">
							{formatCoordinates(cachedLat, cachedLon)} (zuletzt)
						</span>
					</div>
				{:else if isLoggedIn}
					<div class="gps-status none">
						<span class="gps-text">
							Kein GPS - nur Karte oder Suche möglich
						</span>
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
	}

	.filter-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 2px 2rem;
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
		color: var(--text-accent, #059669);
		font-weight: 500;
		font-size: 16px;
	}

	:global(.dark) .location-filter {
		color: var(--text-accent, #10b981);
	}

	.location-icon {
		font-size: 18px;
	}

	/* GPS Status Styling - Theme-aware with different states */
	.gps-status {
		font-weight: 500;
		font-size: 16px;
	}

	/* Active GPS - Green */
	.gps-status.active {
		color: var(--text-accent, #059669);
	}

	:global(.dark) .gps-status.active {
		color: var(--text-accent, #10b981);
	}

	/* Cached GPS - Orange/Yellow */
	.gps-status.cached {
		color: var(--text-accent, #f59e0b);
	}

	:global(.dark) .gps-status.cached {
		color: var(--text-accent, #fbbf24);
	}

	/* No GPS - Red */
	.gps-status.none {
		color: var(--text-accent, #ef4444);
	}

	:global(.dark) .gps-status.none {
		color: var(--text-accent, #f87171);
	}

	.gps-coords {
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
</style> 