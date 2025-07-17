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
  private readonly MAX_IMAGES_IN_MEMORY = 5000; // Speicher-Limit
  private readonly MIN_RADIUS_KM = 25; // Minimum Suchradius
  private readonly MAX_RADIUS_KM = 500; // Maximum Suchradius
  private readonly BATCH_SIZE = 1000; // Batch-Größe für DB-Abfragen
  
  /**
   * Lädt Bilder basierend auf GPS-Position mit intelligentem Nachladen
   */
  async loadImagesForPosition(
    lat: number, 
    lon: number, 
    requestedCount: number = 1000
  ): Promise<LoadedImage[]> {
    console.log(`[IntelligentLoader] Loading images for position: ${lat}, ${lon}`);
    
    // 1. Prüfe bereits geladene Bilder in der Nähe
    const nearbyLoaded = this.getNearbyLoadedImages(lat, lon, 50); // 50km Radius
    console.log(`[IntelligentLoader] Found ${nearbyLoaded.length} already loaded nearby images`);
    
    if (nearbyLoaded.length >= requestedCount) {
      return this.sortByDistance(nearbyLoaded, lat, lon).slice(0, requestedCount);
    }
    
    // 2. Bestimme optimalen Laderadius
    const loadRadius = this.calculateOptimalRadius(lat, lon, requestedCount);
    console.log(`[IntelligentLoader] Using load radius: ${loadRadius}km`);
    
    // 3. Lade neue Bilder aus Datenbank
    const newImages = await this.loadFromDatabase(lat, lon, loadRadius, requestedCount);
    console.log(`[IntelligentLoader] Loaded ${newImages.length} new images from database`);
    
    // 4. Registriere geladene Region
    this.registerLoadedRegion(lat, lon, loadRadius, newImages.map(img => img.id));
    
    // 5. Speicher-Management
    this.manageMemory();
    
    // 6. Kombiniere und sortiere alle verfügbaren Bilder
    const allAvailableImages = [
      ...nearbyLoaded,
      ...newImages.filter(img => !this.loadedImages.has(img.id))
    ];
    
    return this.sortByDistance(allAvailableImages, lat, lon).slice(0, requestedCount);
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
    
    // Berechne Lat/Lon-Grenzen für Radius
    const kmToDegLat = 1 / 111.0;
    const kmToDegLon = 1 / (111.0 * Math.cos(lat * Math.PI / 180));
    const latMargin = radiusKm * kmToDegLat;
    const lonMargin = radiusKm * kmToDegLon;
    
    const minLat = lat - latMargin;
    const maxLat = lat + latMargin;
    const minLon = lon - lonMargin;
    const maxLon = lon + lonMargin;
    
    console.log(`[IntelligentLoader] DB query bounds: lat ${minLat}-${maxLat}, lon ${minLon}-${maxLon}`);
    
    let query = supabase
      .from('items')
      .select('id, lat, lon, path_512, path_2048, path_64, title, description, width, height, is_private, profile_id')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .not('path_512', 'is', null)
      .gte('lat', minLat)
      .lte('lat', maxLat)
      .gte('lon', minLon)
      .lte('lon', maxLon)
      .limit(maxImages * 2); // Etwas mehr laden für bessere Auswahl
    
    // Privacy-Filter anwenden
    if (currentUserId) {
      query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
    } else {
      query = query.or('is_private.eq.false,is_private.is.null');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[IntelligentLoader] Database error:', error);
      return [];
    }
    
    const images = (data || []).map(item => ({
      ...item,
      lat: item.lat!,
      lon: item.lon!,
      path_512: item.path_512!
    }));
    
    // Füge zu geladenen Bildern hinzu
    images.forEach(img => {
      this.loadedImages.set(img.id, img);
    });
    
    return images;
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
    
    // Adaptive Radius-Berechnung basierend auf gewünschter Bildanzahl
    // Mehr Bilder = größerer Radius (Annahme: ~10 Bilder pro km² in dicht besiedelten Gebieten)
    const estimatedRadius = Math.sqrt(requestedCount / (10 * Math.PI));
    return Math.min(this.MAX_RADIUS_KM, Math.max(this.MIN_RADIUS_KM, estimatedRadius));
  }
  
  /**
   * Gibt bereits geladene Bilder in der Nähe einer Position zurück
   */
  private getNearbyLoadedImages(lat: number, lon: number, radiusKm: number): LoadedImage[] {
    const nearby: LoadedImage[] = [];
    const radiusMeters = radiusKm * 1000;
    
    for (const [id, image] of this.loadedImages) {
      const distance = this.calculateDistance(lat, lon, image.lat, image.lon);
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
      distance: this.calculateDistance(lat, lon, img.lat, img.lon)
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
    
    console.log(`[IntelligentLoader] Registered region: ${lat}, ${lon} (${radius}km, ${imageIds.length} images)`);
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