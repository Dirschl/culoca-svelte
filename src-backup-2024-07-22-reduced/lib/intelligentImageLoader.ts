import { supabase } from './supabaseClient';
import { get } from 'svelte/store';
import { sessionStore } from './sessionStore';

interface LoadedImage {
  id: string;
  lat: number;
  lon: number;
  path_512: string;
  path_2048?: string;
  path_64?: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  is_private?: boolean;
  profile_id?: string;
  distance?: number;
}

interface LoadedRegion {
  centerLat: number;
  centerLon: number;
  radius: number;
  imageIds: Set<string>;
  loadedAt: number;
}

class IntelligentImageLoader {
  private loadedImages: Map<string, LoadedImage> = new Map();
  private loadedRegions: LoadedRegion[] = [];
  private readonly MAX_IMAGES_IN_MEMORY = Infinity; // Keine Begrenzung
  private readonly MAX_RADIUS_KM = Infinity; // Keine Begrenzung
  private readonly BATCH_SIZE = Infinity; // Kein Limit - alle Bilder
  
  /**
   * Lädt Bilder basierend auf GPS-Position mit intelligentem Nachladen
   */
  async loadImagesForPosition(
    lat: number, 
    lon: number, 
    requestedCount: number = Infinity
  ): Promise<LoadedImage[]> {
    console.log(`[IntelligentLoader] Loading images for position: ${lat}, ${lon}`);
    
    // 1. Prüfe bereits geladene Bilder in der Nähe
    const nearbyLoaded = this.getNearbyLoadedImages(lat, lon, 50); // 50km Radius
    console.log(`[IntelligentLoader] Found ${nearbyLoaded.length} already loaded nearby images`);
    
    if (nearbyLoaded.length >= requestedCount) {
      // Use already calculated distances, no additional sorting needed
      return nearbyLoaded.slice(0, requestedCount);
    }
    
    // 2. Bestimme optimalen Laderadius
    const loadRadius = this.calculateOptimalRadius(lat, lon, requestedCount);
    
    // 3. Lade neue Bilder aus Datenbank (already sorted by distance)
    const newImages = await this.loadFromDatabase(lat, lon, loadRadius, requestedCount);
    console.log(`[IntelligentLoader] Loaded ${newImages.length} new images from database`);
    
    // 4. Registriere geladene Region
    this.registerLoadedRegion(lat, lon, loadRadius, newImages.map(img => img.id));
    
    // 5. Speicher-Management
    this.manageMemory();
    
    // 6. Kombiniere alle verfügbaren Bilder und sortiere nach Distanz
    const allAvailableImages = [...newImages];
    
    console.log(`[IntelligentLoader] Debug - nearbyLoaded: ${nearbyLoaded.length}, newImages: ${newImages.length}, using: ${allAvailableImages.length}`);
    
    // Ensure all images have distances calculated
    allAvailableImages.forEach(img => {
      if (img.distance === undefined || img.distance === null) {
        img.distance = this.calculateDistance(lat, lon, img.lat, img.lon);
      }
    });
    
    // Sort all images by distance to ensure correct order
    const sortedImages = allAvailableImages.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    
    console.log(`[IntelligentLoader] Final sorted images - first 3 distances:`, sortedImages.slice(0, 3).map(img => img.distance?.toFixed(0) + 'm'));
    
    return sortedImages.slice(0, requestedCount);
  }
  
  /**
   * Lädt Bilder direkt aus der Datenbank (bypass API)
   */
  private async loadFromDatabase(
    lat: number, 
    lon: number, 
    radiusKm: number, 
    maxImages: number
  ): Promise<LoadedImage[]> {
    const sessionData = get(sessionStore);
    const currentUserId = sessionData.isAuthenticated ? sessionData.userId : null;
    
    console.log(`[IntelligentLoader] Loading from database: lat=${lat}, lon=${lon}, radius=${radiusKm}km, max=${maxImages}`);
    
    // Use direct table query since the database function has schema issues
    console.log('[IntelligentLoader] Using direct table query');
      
      // No geographic boundaries - load all images
      const minLat = -90;
      const maxLat = 90;
      const minLon = -180;
      const maxLon = 180;
      
      let fallbackQuery = supabase
        .from('items')
        .select('id, lat, lon, path_512, path_2048, path_64, title, description, width, height, is_private, profile_id')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .eq('gallery', true) // Only show images with gallery = true
        // No geographic filtering - load all images
        // Kein Limit - lade alle Bilder
      
      // Privacy-Filter anwenden
      if (currentUserId) {
        fallbackQuery = fallbackQuery.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
      } else {
        fallbackQuery = fallbackQuery.or('is_private.eq.false,is_private.is.null');
      }
      
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      
      if (fallbackError) {
        console.error('[IntelligentLoader] Fallback query error:', fallbackError);
        return [];
      }
      
      console.log(`[IntelligentLoader] Fallback query returned ${fallbackData?.length || 0} images`);
      
      const fallbackImages = (fallbackData || []).map(item => ({
        id: item.id,
        lat: item.lat,
        lon: item.lon,
        path_512: item.path_512,
        path_2048: item.path_2048,
        path_64: item.path_64,
        title: item.title,
        description: item.description,
        width: item.width,
        height: item.height,
        is_private: item.is_private,
        profile_id: item.profile_id,
        distance: this.calculateDistance(lat, lon, item.lat, item.lon) // Calculate distance client-side in meters
      }));
      
      // Sort by distance
      fallbackImages.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      console.log(`[IntelligentLoader] After sorting - first 3 distances:`, fallbackImages.slice(0, 3).map(img => img.distance?.toFixed(0) + 'm'));
      
      // No radius filtering - use all images
      const radiusFilteredImages = fallbackImages;
      console.log(`[IntelligentLoader] Using all ${radiusFilteredImages.length} images without radius filtering`);
      
      // Ensure the selected item (if any) is always first
      // This is important for anchor-based navigation
      const selectedItemId = (window as any).selectedItemId;
      if (selectedItemId) {
        const selectedItemIndex = radiusFilteredImages.findIndex(img => img.id === selectedItemId);
        if (selectedItemIndex > 0) {
          // Move selected item to first position
          const selectedItem = radiusFilteredImages.splice(selectedItemIndex, 1)[0];
          radiusFilteredImages.unshift(selectedItem);
          console.log(`[IntelligentLoader] Moved selected item ${selectedItemId} to first position`);
        } else if (selectedItemIndex === 0) {
          // Selected item is already first, ensure its distance is 0
          radiusFilteredImages[0].distance = 0;
          console.log(`[IntelligentLoader] Selected item ${selectedItemId} is already first, set distance to 0`);
        } else if (selectedItemIndex === -1) {
          // Selected item not found in filtered images, try to find it in all loaded images
          const allSelectedItem = this.loadedImages.get(selectedItemId);
          if (allSelectedItem) {
            // Add the selected item to the beginning with distance 0
            allSelectedItem.distance = 0;
            radiusFilteredImages.unshift(allSelectedItem);
            console.log(`[IntelligentLoader] Added selected item ${selectedItemId} to first position with 0m distance`);
          }
        }
      }
      
      // Ensure the first image is actually the closest (double-check sorting)
      if (radiusFilteredImages.length > 0) {
        const firstImage = radiusFilteredImages[0];
        const actualDistance = this.calculateDistance(lat, lon, firstImage.lat, firstImage.lon);
        console.log(`[IntelligentLoader] First image distance verification: calculated=${actualDistance?.toFixed(0)}m, stored=${firstImage.distance?.toFixed(0)}m`);
        
        // If there's a mismatch, recalculate all distances
        if (Math.abs(actualDistance - (firstImage.distance || 0)) > 1) {
          console.log(`[IntelligentLoader] Distance mismatch detected, recalculating all distances`);
          radiusFilteredImages.forEach(img => {
            img.distance = this.calculateDistance(lat, lon, img.lat, img.lon);
          });
          radiusFilteredImages.sort((a, b) => (a.distance || 0) - (b.distance || 0));
          console.log(`[IntelligentLoader] After recalculation - first 3 distances:`, radiusFilteredImages.slice(0, 3).map(img => img.distance?.toFixed(0) + 'm'));
        }
      }
      
      console.log(`[IntelligentLoader] After radius filtering: ${radiusFilteredImages.length} images`);
      
      // Debug: Log first few images with distances
      if (radiusFilteredImages.length > 0) {
        console.log(`[IntelligentLoader] First 3 images with distances:`, radiusFilteredImages.slice(0, 3).map(img => ({
          id: img.id,
          distance: img.distance?.toFixed(0) + 'm',
          lat: img.lat,
          lon: img.lon
        })));
      }
      
      // Füge zu geladenen Bildern hinzu
      radiusFilteredImages.forEach(img => {
        this.loadedImages.set(img.id, img);
      });
      
      return radiusFilteredImages;
    }
  
  /**
   * Berechnet optimalen Radius basierend auf Position und gewünschter Bildanzahl
   */
  private calculateOptimalRadius(lat: number, lon: number, requestedCount: number): number {
    // Prüfe ob wir bereits Daten für diese Region haben
    const nearestRegion = this.findNearestLoadedRegion(lat, lon);
    
    if (nearestRegion && nearestRegion.imageIds.size > 0) {
      // Erweitere bestehende Region
      const distance = this.calculateDistance(lat, lon, nearestRegion.centerLat, nearestRegion.centerLon) / 1000;
      return Math.min(this.MAX_RADIUS_KM, Math.max(this.MIN_RADIUS_KM, distance + nearestRegion.radius));
    }
    
    // No radius limitation - use maximum possible radius
    return this.MAX_RADIUS_KM;
  }
  
  /**
   * Gibt bereits geladene Bilder in der Nähe einer Position zurück
   */
  private getNearbyLoadedImages(lat: number, lon: number, radiusKm: number): LoadedImage[] {
    const nearby: LoadedImage[] = [];
    const radiusMeters = radiusKm * 1000;
    
    for (const [id, image] of this.loadedImages) {
      // Use distance if already calculated, otherwise calculate it
      const distance = image.distance !== undefined ? image.distance : this.calculateDistance(lat, lon, image.lat, image.lon);
      if (distance <= radiusMeters) {
        nearby.push({ ...image, distance });
      }
    }
    
    return nearby;
  }
  
  /**
   * Sortiert Bilder nach Entfernung von gegebener Position
   */
  private sortByDistance(images: LoadedImage[], lat: number, lon: number): LoadedImage[] {
    return images.map(img => ({
      ...img,
      // Use distance if already calculated by database, otherwise calculate it
      distance: img.distance !== undefined ? img.distance : this.calculateDistance(lat, lon, img.lat, img.lon)
    })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }
  
  /**
   * Berechnet Entfernung zwischen zwei GPS-Koordinaten (Haversine-Formel)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Erdradius in Metern
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const deltaLatRad = (lat2 - lat1) * Math.PI / 180;
    const deltaLonRad = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
             Math.cos(lat1Rad) * Math.cos(lat2Rad) *
             Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }
  
  /**
   * Registriert eine geladene Region zur Vermeidung doppelter Ladevorgänge
   */
  private registerLoadedRegion(lat: number, lon: number, radius: number, imageIds: string[]): void {
    this.loadedRegions.push({
      centerLat: lat,
      centerLon: lon,
      radius,
      imageIds: new Set(imageIds),
      loadedAt: Date.now()
    });
  }
  
  /**
   * Findet die nächstgelegene bereits geladene Region
   */
  private findNearestLoadedRegion(lat: number, lon: number): LoadedRegion | null {
    let nearest: LoadedRegion | null = null;
    let nearestDistance = Infinity;
    
    for (const region of this.loadedRegions) {
      const distance = this.calculateDistance(lat, lon, region.centerLat, region.centerLon);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = region;
      }
    }
    
    return nearest;
  }
  
  /**
   * Speicher-Management: Entfernt alte/entfernte Bilder bei Speicherlimit
   */
  private manageMemory(): void {
    if (this.loadedImages.size <= this.MAX_IMAGES_IN_MEMORY) return;
    
    console.log(`[IntelligentLoader] Memory management: ${this.loadedImages.size} images loaded, cleaning up...`);
    
    // Entferne älteste Regionen zuerst
    this.loadedRegions.sort((a, b) => a.loadedAt - b.loadedAt);
    
    while (this.loadedImages.size > this.MAX_IMAGES_IN_MEMORY * 0.8 && this.loadedRegions.length > 0) {
      const oldestRegion = this.loadedRegions.shift()!;
      
      // Entferne Bilder aus dieser Region
      for (const imageId of oldestRegion.imageIds) {
        this.loadedImages.delete(imageId);
      }
      
      console.log(`[IntelligentLoader] Removed region with ${oldestRegion.imageIds.size} images`);
    }
  }
  
  /**
   * Gibt Statistiken über geladene Daten zurück
   */
  getStats(): { loadedImages: number; loadedRegions: number; memoryUsage: string } {
    const memoryUsage = `${this.loadedImages.size}/${this.MAX_IMAGES_IN_MEMORY}`;
    return {
      loadedImages: this.loadedImages.size,
      loadedRegions: this.loadedRegions.length,
      memoryUsage
    };
  }
  
  /**
   * Leert den gesamten Cache (für Tests/Reset)
   */
  clearCache(): void {
    this.loadedImages.clear();
    this.loadedRegions = [];
    console.log('[IntelligentLoader] Cache cleared');
  }
}

// Singleton-Instance
export const intelligentImageLoader = new IntelligentImageLoader(); 