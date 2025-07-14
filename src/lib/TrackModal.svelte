<script lang="ts">
  import { trackStore } from './trackStore';
  import { downloadTrack, emailTrack } from './trackExport';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let isOpen = false;
  
  let savedTracks: any[] = [];
  let selectedTrack: any = null;
  let emailAddress = '';
  let emailSending = false;
  let emailSuccess = false;
  let emailError = '';
  
  trackStore.subscribe(state => {
    savedTracks = state.savedTracks;
  });
  
  function closeModal() {
    isOpen = false;
    dispatch('close');
  }
  
  function selectTrack(track: any) {
    selectedTrack = track;
  }
  
  function deleteTrack(trackId: string) {
    if (confirm('Track wirklich löschen?')) {
      trackStore.deleteTrack(trackId);
      if (selectedTrack?.id === trackId) {
        selectedTrack = null;
      }
    }
  }
  
  function clearAllTracks() {
    if (confirm('Alle Tracks wirklich löschen?')) {
      trackStore.clearAllTracks();
      selectedTrack = null;
    }
  }
  
  async function sendTrackEmail() {
    if (!selectedTrack || !emailAddress) return;
    
    emailSending = true;
    emailError = '';
    emailSuccess = false;
    
    try {
      const success = await emailTrack(selectedTrack, emailAddress);
      if (success) {
        emailSuccess = true;
        emailAddress = '';
      } else {
        emailError = 'Fehler beim Senden der Email';
      }
    } catch (error) {
      emailError = 'Fehler beim Senden der Email';
    } finally {
      emailSending = false;
    }
  }
  
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('de-DE');
  }
  
  function formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(2)}km`;
    }
  }
  
  function formatDuration(ms: number): string {
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

{#if isOpen}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🗺️ GPS-Tracks</h2>
        <button class="close-btn" on:click={closeModal}>&times;</button>
      </div>
      
      <div class="modal-body">
        {#if savedTracks.length === 0}
          <div class="empty-state">
            <div class="empty-icon">🗺️</div>
            <h3>Noch keine Tracks</h3>
            <p>Starte eine Tour mit dem Track-Button, um deine Route aufzuzeichnen.</p>
          </div>
        {:else}
          <div class="tracks-container">
            <div class="tracks-list">
              <h3>Gespeicherte Touren ({savedTracks.length})</h3>
              {#each savedTracks as track}
                <div 
                  class="track-item {selectedTrack?.id === track.id ? 'selected' : ''}"
                  on:click={() => selectTrack(track)}
                >
                  <div class="track-info">
                    <h4>{track.name}</h4>
                    <div class="track-details">
                      <span>📅 {formatDate(track.startTime)}</span>
                      <span>📏 {formatDistance(track.totalDistance)}</span>
                      <span>⏱️ {formatDuration(track.totalDuration)}</span>
                      <span>📍 {track.points.length} Punkte</span>
                    </div>
                  </div>
                  <button 
                    class="delete-btn"
                    on:click|stopPropagation={() => deleteTrack(track.id)}
                    title="Track löschen"
                  >
                    🗑️
                  </button>
                </div>
              {/each}
              
              <button class="clear-all-btn" on:click={clearAllTracks}>
                🗑️ Alle Tracks löschen
              </button>
            </div>
            
            {#if selectedTrack}
              <div class="track-details-panel">
                <h3>Track-Details</h3>
                <div class="track-detail-info">
                  <div class="detail-row">
                    <strong>Name:</strong> {selectedTrack.name}
                  </div>
                  <div class="detail-row">
                    <strong>Start:</strong> {formatDate(selectedTrack.startTime)}
                  </div>
                  {#if selectedTrack.endTime}
                    <div class="detail-row">
                      <strong>Ende:</strong> {formatDate(selectedTrack.endTime)}
                    </div>
                  {/if}
                  <div class="detail-row">
                    <strong>Distanz:</strong> {formatDistance(selectedTrack.totalDistance)}
                  </div>
                  <div class="detail-row">
                    <strong>Dauer:</strong> {formatDuration(selectedTrack.totalDuration)}
                  </div>
                  <div class="detail-row">
                    <strong>Punkte:</strong> {selectedTrack.points.length}
                  </div>
                </div>
                
                <div class="export-section">
                  <h4>Export</h4>
                  <div class="export-buttons">
                    <button 
                      class="export-btn"
                      on:click={() => downloadTrack(selectedTrack, 'gpx')}
                    >
                      📥 GPX
                    </button>
                    <button 
                      class="export-btn"
                      on:click={() => downloadTrack(selectedTrack, 'geojson')}
                    >
                      📥 GeoJSON
                    </button>
                    <button 
                      class="export-btn"
                      on:click={() => downloadTrack(selectedTrack, 'kml')}
                    >
                      📥 KML
                    </button>
                  </div>
                  
                  <div class="email-section">
                    <h4>Per Email senden</h4>
                    <div class="email-input-group">
                      <input 
                        type="email" 
                        placeholder="Email-Adresse"
                        bind:value={emailAddress}
                        disabled={emailSending}
                      />
                      <button 
                        class="email-btn"
                        on:click={sendTrackEmail}
                        disabled={!emailAddress || emailSending}
                      >
                        {emailSending ? 'Sende...' : '📧 Senden'}
                      </button>
                    </div>
                    {#if emailSuccess}
                      <div class="email-success">✅ Email erfolgreich gesendet!</div>
                    {/if}
                    {#if emailError}
                      <div class="email-error">❌ {emailError}</div>
                    {/if}
                  </div>
                </div>
              </div>
            {:else}
              <div class="no-selection">
                <div class="no-selection-icon">👆</div>
                <p>Wähle einen Track aus, um Details zu sehen und zu exportieren.</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  }
  
  .modal-content {
    background: var(--bg-color, white);
    border-radius: 12px;
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-color, #eee);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }
  
  .close-btn:hover {
    background: var(--hover-bg, #f0f0f0);
  }
  
  .modal-body {
    padding: 20px;
    max-height: calc(80vh - 80px);
    overflow-y: auto;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .tracks-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    height: 100%;
  }
  
  .tracks-list {
    border-right: 1px solid var(--border-color, #eee);
    padding-right: 20px;
  }
  
  .tracks-list h3 {
    margin-top: 0;
    margin-bottom: 16px;
  }
  
  .track-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border: 1px solid var(--border-color, #eee);
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .track-item:hover {
    background: var(--hover-bg, #f8f9fa);
  }
  
  .track-item.selected {
    background: var(--accent-color, #007bff);
    color: white;
    border-color: var(--accent-color, #007bff);
  }
  
  .track-info h4 {
    margin: 0 0 4px 0;
    font-size: 14px;
  }
  
  .track-details {
    display: flex;
    gap: 8px;
    font-size: 12px;
    opacity: 0.8;
  }
  
  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  .delete-btn:hover {
    background: rgba(255, 0, 0, 0.1);
  }
  
  .clear-all-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    margin-top: 16px;
  }
  
  .track-details-panel {
    padding-left: 20px;
  }
  
  .track-details-panel h3 {
    margin-top: 0;
    margin-bottom: 16px;
  }
  
  .track-detail-info {
    margin-bottom: 20px;
  }
  
  .detail-row {
    margin-bottom: 8px;
    font-size: 14px;
  }
  
  .export-section h4 {
    margin-bottom: 12px;
  }
  
  .export-buttons {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }
  
  .export-btn {
    background: var(--accent-color, #007bff);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .export-btn:hover {
    background: var(--accent-hover, #0056b3);
  }
  
  .email-section h4 {
    margin-bottom: 12px;
  }
  
  .email-input-group {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .email-input-group input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 6px;
    font-size: 14px;
  }
  
  .email-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .email-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
  
  .email-success {
    color: #28a745;
    font-size: 12px;
    margin-top: 8px;
  }
  
  .email-error {
    color: #dc3545;
    font-size: 12px;
    margin-top: 8px;
  }
  
  .no-selection {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted, #666);
  }
  
  .no-selection-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  @media (max-width: 768px) {
    .tracks-container {
      grid-template-columns: 1fr;
    }
    
    .tracks-list {
      border-right: none;
      border-bottom: 1px solid var(--border-color, #eee);
      padding-right: 0;
      padding-bottom: 20px;
    }
    
    .track-details {
      flex-direction: column;
      gap: 2px;
    }
  }
</style> 