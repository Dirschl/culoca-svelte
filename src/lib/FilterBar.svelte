<script lang="ts">
	import { filterStore, userFilter, locationFilter, hasActiveFilters } from './filterStore';
	import { User, MapPin, X } from 'lucide-svelte';

	export let showOnMap = false; // Different styling for map vs gallery
</script>

{#if $hasActiveFilters}
	<div class="filter-bar {showOnMap ? 'map-style' : 'gallery-style'}">
		<div class="filter-container">
			{#if $userFilter}
				<div class="filter-item user-filter">
					<User size={16} />
					<span class="filter-text">
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
			{/if}

			{#if $locationFilter}
				<div class="filter-item location-filter">
					<MapPin size={16} />
					<span class="filter-text">
						{$locationFilter.name}
					</span>
					<button 
						class="remove-filter"
						on:click={() => filterStore.clearLocationFilter()}
						aria-label="Standort-Filter entfernen"
					>
						<X size={14} />
					</button>
				</div>
			{/if}

			{#if $userFilter && $locationFilter}
				<button 
					class="clear-all"
					on:click={() => filterStore.clearFilters()}
					title="Alle Filter entfernen"
				>
					Alle entfernen
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.filter-bar {
		width: 100%;
		z-index: 1000;
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		animation: slideDown 0.3s ease-out;
	}

	.gallery-style {
		background: rgba(0, 0, 0, 0.9);
		color: white;
		padding: 12px 16px;
		position: sticky;
		top: 0;
	}

	.map-style {
		background: rgba(255, 255, 255, 0.95);
		color: #333;
		padding: 8px 12px;
		position: absolute;
		top: 10px;
		left: 10px;
		right: 10px;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.filter-container {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		max-width: 1200px;
		margin: 0 auto;
	}

	.filter-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 20px;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.gallery-style .filter-item {
		background: rgba(255, 255, 255, 0.15);
		color: white;
	}

	.map-style .filter-item {
		background: rgba(0, 0, 0, 0.1);
		color: #333;
	}

	.user-filter {
		border-left: 3px solid #3b82f6;
	}

	.location-filter {
		border-left: 3px solid #10b981;
	}

	.filter-text {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.remove-filter {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		border-radius: 50%;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gallery-style .remove-filter {
		color: rgba(255, 255, 255, 0.7);
	}

	.gallery-style .remove-filter:hover {
		background: rgba(255, 255, 255, 0.2);
		color: white;
	}

	.map-style .remove-filter {
		color: rgba(0, 0, 0, 0.5);
	}

	.map-style .remove-filter:hover {
		background: rgba(0, 0, 0, 0.1);
		color: #333;
	}

	.clear-all {
		background: none;
		border: 1px solid;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.gallery-style .clear-all {
		border-color: rgba(255, 255, 255, 0.3);
		color: rgba(255, 255, 255, 0.8);
	}

	.gallery-style .clear-all:hover {
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.map-style .clear-all {
		border-color: rgba(0, 0, 0, 0.2);
		color: rgba(0, 0, 0, 0.6);
	}

	.map-style .clear-all:hover {
		background: rgba(0, 0, 0, 0.05);
		color: #333;
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@media (max-width: 768px) {
		.filter-container {
			gap: 8px;
		}
		
		.filter-item {
			padding: 4px 8px;
			font-size: 13px;
		}
		
		.filter-text {
			max-width: 120px;
		}
		
		.clear-all {
			padding: 3px 6px;
			font-size: 11px;
		}
	}
</style> 