import { writable } from 'svelte/store';

export interface GPSSimulationData {
  lat: number;
  lon: number;
  active: boolean;
  timestamp: number;
}

// Create a writable store for GPS simulation data
export const gpsSimulationStore = writable<GPSSimulationData | null>(null);

// Helper function to update simulation data
export function updateGPSSimulation(lat: number, lon: number, active: boolean = true) {
  gpsSimulationStore.set({
    lat,
    lon,
    active,
    timestamp: Date.now()
  });
}

// Helper function to clear simulation data
export function clearGPSSimulation() {
  gpsSimulationStore.set(null);
}

// Helper function to check if simulation is active
export function isSimulationActive() {
  let isActive = false;
  gpsSimulationStore.subscribe(data => {
    isActive = data?.active || false;
  })();
  return isActive;
} 