import { supabase } from './supabaseClient';

interface LoadedCell {
  gridX: number;
  gridY: number;
  centerLat: number;
  centerLon: number;
  timestamp: number;
}

export class DynamicImageLoader {
  private loadedImages = new Map<string, any>(); // ID -> Image
  private loadedCells: LoadedCell[] = [];
  private currentUserId: string | null = null;

  // Allow host app to define current user for privacy filtering
  setCurrentUserId(uid: string | null) {
    this.currentUserId = uid;
  }
  private isLoading = false;
  private loadQueue: Array<{ lat: number; lon: number }> = [];
  private currentCenterCell: { x: number; y: number } | null = null;
  
  // Grid configuration
  private readonly CELL_SIZE_KM = 10; // 10km x 10km cells
  private readonly CELL_SIZE_DEG = this.CELL_SIZE_KM / 111.0; // Convert km to degrees
  private readonly GRID_SIZE = 3; // 3x3 grid around current position

  constructor() {
    // Removed automatic initial load to avoid race conditions.
    // The host app should explicitly call loadImagesForPosition with the desired coordinates.
  }

  private initialize() {
    // Initialize with default position (Berlin)
    this.loadImagesForPosition(52.520, 13.405);
  }

  // Get all currently loaded images as array
  getAllImages(): any[] {
    return Array.from(this.loadedImages.values());
  }

  // Get images count
  getImageCount(): number {
    return this.loadedImages.size;
  }

  // Convert lat/lon to grid coordinates
  latLonToGrid(lat: number, lon: number): { x: number; y: number } {
    const x = Math.floor(lon / this.CELL_SIZE_DEG);
    const y = Math.floor(lat / this.CELL_SIZE_DEG);
    return { x, y };
  }

  // Convert grid coordinates to cell center lat/lon
  gridToLatLon(gridX: number, gridY: number): { lat: number; lon: number } {
    const lat = (gridY + 0.5) * this.CELL_SIZE_DEG;
    const lon = (gridX + 0.5) * this.CELL_SIZE_DEG;
    return { lat, lon };
  }

  // Get the 3x3 grid of cells around a position
  getRequiredCells(centerGrid: { x: number; y: number }): Array<{ x: number; y: number }> {
    const cells: Array<{ x: number; y: number }> = [];
    const halfGrid = Math.floor(this.GRID_SIZE / 2); // 1 for 3x3 grid
    // 3x3 grid around the center
    for (let dx = -halfGrid; dx <= halfGrid; dx++) {
      for (let dy = -halfGrid; dy <= halfGrid; dy++) {
        cells.push({
          x: centerGrid.x + dx,
          y: centerGrid.y + dy
        });
      }
    }
    // Debug: Log required cells and loaded cells
    console.log('[DynamicLoader] Required cells:', cells.map(c => `${c.x},${c.y}`));
    console.log('[DynamicLoader] Loaded cells:', this.loadedCells.map(c => `${c.gridX},${c.gridY}`));
    return cells;
  }

  // Check if a cell is already loaded
  isCellLoaded(gridX: number, gridY: number): boolean {
    return this.loadedCells.some(cell => cell.gridX === gridX && cell.gridY === gridY);
  }

  // Get the center cell of the current grid
  getCurrentCenterCell(): { x: number; y: number } | null {
    return this.currentCenterCell;
  }

  // Check if a position is in the center cell
  isInCenterCell(lat: number, lon: number): boolean {
    if (!this.currentCenterCell) return false;
    const positionGrid = this.latLonToGrid(lat, lon);
    return positionGrid.x === this.currentCenterCell.x && positionGrid.y === this.currentCenterCell.y;
  }

  // Remove images outside the current 3x3 grid
  private cleanupImagesOutsideGrid(centerGrid: { x: number; y: number }) {
    const requiredCells = this.getRequiredCells(centerGrid);
    const requiredCellKeys = new Set(requiredCells.map(cell => `${cell.x},${cell.y}`));
    
    console.log(`🗺️ Cleanup: Required cells for center ${centerGrid.x},${centerGrid.y}:`, Array.from(requiredCellKeys));
    console.log(`🗺️ Cleanup: Currently loaded ${this.loadedImages.size} images`);
    
    // Remove images that are not in the current 3x3 grid
    const imagesToRemove: string[] = [];
    this.loadedImages.forEach((image, imageId) => {
      if (image.lat && image.lon) {
        const imageGrid = this.latLonToGrid(image.lat, image.lon);
        const imageCellKey = `${imageGrid.x},${imageGrid.y}`;
        
        if (!requiredCellKeys.has(imageCellKey)) {
          imagesToRemove.push(imageId);
          console.log(`🗺️ Cleanup: Will remove image ${imageId} from cell ${imageCellKey} (not in required cells)`);
        } else {
          console.log(`🗺️ Cleanup: Keeping image ${imageId} from cell ${imageCellKey} (in required cells)`);
        }
      }
    });
    
    // Remove the images
    imagesToRemove.forEach(imageId => {
      this.loadedImages.delete(imageId);
    });
    
    console.log(`🗺️ Cleaned up ${imagesToRemove.length} images outside current 3x3 grid`);
    
    // Also remove cells that are no longer in the current grid
    const cellsToRemove = this.loadedCells.filter(cell => {
      const cellKey = `${cell.gridX},${cell.gridY}`;
      return !requiredCellKeys.has(cellKey);
    });
    
    this.loadedCells = this.loadedCells.filter(cell => {
      const cellKey = `${cell.gridX},${cell.gridY}`;
      return requiredCellKeys.has(cellKey);
    });
    
    console.log(`🗺️ Cleaned up ${cellsToRemove.length} cells outside current 3x3 grid`);
    console.log(`🗺️ After cleanup: ${this.loadedImages.size} images, ${this.loadedCells.length} cells remaining`);
  }

  // Load images for a specific position
  async loadImagesForPosition(lat: number, lon: number): Promise<any[]> {
    const newCenterGrid = this.latLonToGrid(lat, lon);
    
    // Check if we need to move the grid
    if (this.currentCenterCell && 
        (newCenterGrid.x !== this.currentCenterCell.x || newCenterGrid.y !== this.currentCenterCell.y)) {
      
      console.log(`🗺️ Moving grid from center ${this.currentCenterCell.x},${this.currentCenterCell.y} to ${newCenterGrid.x},${newCenterGrid.y}`);
      
      // Get the new 3x3 grid around the new center
      const newRequiredCells = this.getRequiredCells(newCenterGrid);
      const newCellKeys = new Set(newRequiredCells.map(cell => `${cell.x},${cell.y}`));
      
      // Find which cells we need to load (not already loaded)
      const cellsToLoad = newRequiredCells.filter(cell => !this.isCellLoaded(cell.x, cell.y));
      
      console.log(`🗺️ Need to load ${cellsToLoad.length} new cells for grid movement`);
      
      // Load the missing cells FIRST, before cleanup
      for (const cell of cellsToLoad) {
        await this.loadCell(cell, lat, lon);
      }
      
      // Clean up images outside the new grid AFTER loading new cells
      this.cleanupImagesOutsideGrid(newCenterGrid);
      
      // Update the center cell
      this.currentCenterCell = newCenterGrid;
      
    } else if (!this.currentCenterCell) {   // Initial load - load the entire 3x3 grid
      console.log(`🗺️ Initial grid load for center ${newCenterGrid.x},${newCenterGrid.y}`);
      
      const requiredCells = this.getRequiredCells(newCenterGrid);
      for (const cell of requiredCells) {
        await this.loadCell(cell, lat, lon);
      }
      
      this.currentCenterCell = newCenterGrid;
    } else {
      console.log(`🗺️ Position ${lat},${lon} is still in center cell ${this.currentCenterCell.x},${this.currentCenterCell.y} - no grid movement needed`);
    }

    console.log(`[DynamicLoader] Total images currently loaded (3x3 grid context): ${this.loadedImages.size}`);
    return this.getAllImages();
  }

  private async loadCell(cell: { x: number; y: number }, centerLat: number, centerLon: number): Promise<void> {
    if (this.isLoading) {
      this.loadQueue.push({ lat: centerLat, lon: centerLon });
      return;
    }
    
    this.isLoading = true;
    
    try {
      // Calculate cell bounds
      const cellCenterLon = (cell.x + 0.5) * this.CELL_SIZE_DEG;
      const cellCenterLat = (cell.y + 0.5) * this.CELL_SIZE_DEG;
      
      console.log(`🗺️ Loading cell ${cell.x},${cell.y} at ${cellCenterLat}, ${cellCenterLon}`);
      
      const pageSize = 1000;
      let offset = 0;
      let fetchedTotal = 0;

      while (true) {
        const { data: batch, error } = await supabase
          .from('items')
          .select(`
            id,
            title,
            description,
            keywords,
            lat,
            lon,
            path_2048,
            path_512,
            path_64,
            created_at,
            user_id,
            is_private
          `)
          .not('lat', 'is', null)
          .not('lon', 'is', null)
          .gte('lat', cellCenterLat - this.CELL_SIZE_DEG / 2)
          .lte('lat', cellCenterLat + this.CELL_SIZE_DEG / 2)
          .gte('lon', cellCenterLon - this.CELL_SIZE_DEG / 2)
          .lte('lon', cellCenterLon + this.CELL_SIZE_DEG / 2)
          .or(this.currentUserId ? `profile_id.eq.${this.currentUserId},is_private.eq.false,is_private.is.null` : 'is_private.eq.false,is_private.is.null')
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error('Error loading cell batch:', error);
          break;
        }

        if (!batch || batch.length === 0) {
          break;
        }

        batch.forEach(image => {
          if (!this.loadedImages.has(image.id)) {
            this.loadedImages.set(image.id, image);
            fetchedTotal++;
          }
        });

        if (batch.length < pageSize) {
          // last batch fetched
          break;
        }
        offset += pageSize;
      }

      console.log(`🗺️ Loaded ${fetchedTotal} new images from cell ${cell.x},${cell.y}`);
       
      // Mark cell as loaded
      this.loadedCells.push({
        gridX: cell.x,
        gridY: cell.y,
        centerLat: cellCenterLat,
        centerLon: cellCenterLon,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error loading cell:', error);
    } finally {
      this.isLoading = false;
      
      // Process queue
      if (this.loadQueue.length > 0) {
        const next = this.loadQueue.shift();
        if (next) {
          this.loadImagesForPosition(next.lat, next.lon);
        }
      }
    }
  }

  // Calculate distance between two points in meters
  private getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Clear all loaded data
  clear() {
    this.loadedImages.clear();
    this.loadedCells = [];
    this.currentCenterCell = null;
    console.log('[DynamicLoader] Cleared all data');
  }

  // Get debug information
  getDebugInfo() {
    return {
      totalImages: this.loadedImages.size,
      loadedCells: this.loadedCells.length,
      currentCenterCell: this.currentCenterCell,
      gridSize: this.GRID_SIZE,
      isLoading: this.isLoading,
      queueLength: this.loadQueue.length
    };
  }
}

// Export singleton instance
export const dynamicImageLoader = new DynamicImageLoader(); 