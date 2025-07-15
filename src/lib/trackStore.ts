import { writable } from 'svelte/store';

export interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: string;
  accuracy?: number;
  elevation?: number;
}

export interface Track {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  points: TrackPoint[];
  totalDistance: number;
  totalDuration: number;
  isActive: boolean;
}

interface TrackState {
  currentTrack: Track | null;
  savedTracks: Track[];
  isRecording: boolean;
  watchId: number | null;
}

function createTrackStore() {
  // Load saved tracks from localStorage
  const savedTracks = loadTracksFromStorage();
  
  const initialState: TrackState = {
    currentTrack: null,
    savedTracks,
    isRecording: false,
    watchId: null
  };

  const { subscribe, set, update } = writable<TrackState>(initialState);

  let store: any = null;

  store = {
    subscribe,
    
    startTrack: (name: string) => {
      update(state => {
        const newTrack: Track = {
          id: typeof window !== 'undefined' && crypto ? crypto.randomUUID() : Date.now().toString(),
          name,
          startTime: new Date().toISOString(),
          points: [],
          totalDistance: 0,
          totalDuration: 0,
          isActive: true
        };

        return {
          ...state,
          currentTrack: newTrack,
          isRecording: true
        };
      });

      // Start GPS watching
      store.startGpsWatching();
    },

    stopTrack: () => {
      update(state => {
        if (state.currentTrack) {
          state.currentTrack.endTime = new Date().toISOString();
          state.currentTrack.isActive = false;
          state.currentTrack.totalDuration = 
            new Date(state.currentTrack.endTime).getTime() - 
            new Date(state.currentTrack.startTime).getTime();
          
          // Save track
          const updatedTracks = [...state.savedTracks, state.currentTrack];
          saveTracksToStorage(updatedTracks);
          
          return {
            ...state,
            currentTrack: null,
            isRecording: false,
            savedTracks: updatedTracks
          };
        }
        return state;
      });

      store.stopGpsWatching();
    },

    addPoint: (position: GeolocationPosition) => {
      update(state => {
        if (state.currentTrack) {
          const point: TrackPoint = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: new Date().toISOString(),
            accuracy: position.coords.accuracy,
            elevation: position.coords.altitude || undefined
          };

          state.currentTrack.points.push(point);
          state.currentTrack.totalDistance = calculateTotalDistance(state.currentTrack.points);
          
          console.log(`🔄 [Track] Added point ${state.currentTrack.points.length}: ${point.lat}, ${point.lon}`);
          
          // Auto-save to localStorage
          saveTracksToStorage(state.savedTracks);
        }
        return state;
      });
    },

    startGpsWatching: () => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        console.warn('GPS not available in this environment');
        return;
      }
      
      console.log('🔄 [Track] Starting GPS watching...');
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          console.log('🔄 [Track] GPS position received:', position.coords);
          store.addPoint(position);
        },
        (error) => console.error('GPS error:', error),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );

      update(state => ({
        ...state,
        watchId
      }));
    },

    stopGpsWatching: () => {
      update(state => {
        if (state.watchId && typeof window !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(state.watchId);
          console.log('🔄 [Track] Stopped GPS watching');
        }
        return {
          ...state,
          watchId: null
        };
      });
    },

    deleteTrack: (trackId: string) => {
      update(state => {
        const updatedTracks = state.savedTracks.filter(t => t.id !== trackId);
        saveTracksToStorage(updatedTracks);
        return {
          ...state,
          savedTracks: updatedTracks
        };
      });
    },

    clearAllTracks: () => {
      update(state => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.removeItem('culoca_tracks');
        }
        return {
          ...state,
          savedTracks: []
        };
      });
    }
  };

  return store;
}

// Helper functions
function loadTracksFromStorage(): Track[] {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }
    const stored = localStorage.getItem('culoca_tracks');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading tracks from storage:', error);
    return [];
  }
}

function saveTracksToStorage(tracks: Track[]) {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem('culoca_tracks', JSON.stringify(tracks));
  } catch (error) {
    console.error('Error saving tracks to storage:', error);
  }
}

function calculateTotalDistance(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    totalDistance += calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
  }
  
  return totalDistance;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const trackStore = createTrackStore(); 