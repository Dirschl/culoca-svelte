<script lang="ts">
  import { trackStore } from './trackStore';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let isRecording = false;
  let currentTrack: any = null;
  let showTrackModal = false;
  
  trackStore.subscribe(state => {
    isRecording = state.isRecording;
    currentTrack = state.currentTrack;
  });
  
  function startTrack() {
    const trackName = prompt('Name für die Tour eingeben:', `Tour ${new Date().toLocaleDateString()}`);
    if (trackName) {
      trackStore.startTrack(trackName);
    }
  }
  
  function stopTrack() {
    if (confirm('Tour beenden?')) {
      trackStore.stopTrack();
    }
  }
  
  function showTracks() {
    dispatch('showTracks');
  }
</script>

<div class="track-fab-container">
  <!-- Main Track FAB -->
  <button 
    class="track-fab {isRecording ? 'recording' : ''}"
    on:click={isRecording ? stopTrack : startTrack}
    title={isRecording ? 'Tour beenden' : 'Tour starten'}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && (isRecording ? stopTrack() : startTrack())}
  >
    {#if isRecording}
      <span class="fab-icon">🏁</span>
      <span class="fab-label">Stop</span>
    {:else}
      <span class="fab-icon">🚀</span>
      <span class="fab-label">Track</span>
    {/if}
  </button>
  
  <!-- Track Stats (when recording) -->
  {#if isRecording && currentTrack}
    <div class="track-stats">
      <div class="stat">
        <span class="stat-label">⏱️</span>
        <span class="stat-value">{formatDuration(Date.now() - new Date(currentTrack.startTime).getTime())}</span>
      </div>
      <div class="stat">
        <span class="stat-label">📏</span>
        <span class="stat-value">{formatDistance(currentTrack.totalDistance)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">📍</span>
        <span class="stat-value">{currentTrack.points.length}</span>
      </div>
    </div>
  {/if}
  
  <!-- Tracks List FAB -->
  <button 
    class="track-fab secondary"
    on:click={showTracks}
    title="Gespeicherte Touren anzeigen"
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && showTracks()}
  >
    <span class="fab-icon">📋</span>
    <span class="fab-label">Touren</span>
  </button>
</div>

<style>
  .track-fab-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 1000;
  }
  
  .track-fab {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: none;
    background: var(--fab-bg, #333);
    color: var(--fab-color, white);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    user-select: none;
  }
  
  .track-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }
  
  .track-fab:focus {
    outline: 2px solid var(--accent-color, #007bff);
    outline-offset: 2px;
  }
  
  .track-fab.recording {
    background: #dc3545;
    animation: pulse 2s infinite;
  }
  
  .track-fab.secondary {
    width: 50px;
    height: 50px;
    background: var(--fab-secondary-bg, #666);
    font-size: 10px;
  }
  
  .fab-icon {
    font-size: 18px;
    line-height: 1;
  }
  
  .fab-label {
    font-size: 8px;
    margin-top: 2px;
  }
  
  .track-stats {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    display: flex;
    gap: 12px;
    backdrop-filter: blur(10px);
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  
  .stat-label {
    font-size: 10px;
    opacity: 0.8;
  }
  
  .stat-value {
    font-weight: bold;
    font-size: 11px;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .track-fab {
      background: var(--fab-bg-dark, #555);
      color: var(--fab-color-dark, #fff);
    }
    
    .track-fab.secondary {
      background: var(--fab-secondary-bg-dark, #444);
    }
  }
</style>

<script context="module">
  function formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(2)}km`;
    }
  }
  
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
</script> 