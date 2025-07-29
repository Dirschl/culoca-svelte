import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import exifr from 'exifr';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Auto-rotate images based on EXIF orientation
 * This script can process a single item or all items
 */
async function autoRotateImages(targetItemId = null) {
  console.log('🔄 Starting auto-rotate migration...');
  
  try {
    // Get items to process
    let items;
    if (targetItemId) {
      console.log(`🎯 Processing specific item: ${targetItemId}`);
      const { data, error } = await supabase
        .from('items')
        .select('id, path_512, path_2048, path_64, original_name')
        .eq('id', targetItemId);
      
      if (error) throw error;
      items = data;
    } else {
      console.log('📸 Processing all items...');
      const { data, error } = await supabase
        .from('items')
        .select('id, path_512, path_2048, path_64, original_name')
        .not('path_512', 'is', null);
      
      if (error) throw error;
      items = data;
    }
    
    console.log(`📊 Found ${items.length} items to process`);
    
    let processed = 0;
    let rotated = 0;
    let errors = 0;
    
    for (const item of items) {
      console.log(`\n🔧 Processing item: ${item.id} (${item.original_name})`);
      
      try {
        // Get original from Hetzner to check EXIF
        const originalUrl = `${process.env.HETZNER_WEBDAV_PUBLIC_URL || 'https://your-hetzner-url.com'}/items/${item.id}.jpg`;
        
        // Download original to check EXIF orientation
        const response = await fetch(originalUrl);
        if (!response.ok) {
          console.log(`⚠️ Could not download original for ${item.id}, skipping...`);
          processed++;
          continue;
        }
        
        const originalBuffer = Buffer.from(await response.arrayBuffer());
        
        // Extract EXIF orientation
        const exif = await exifr.parse(originalBuffer);
        const orientation = exif?.Orientation;
        
        console.log(`📐 EXIF Orientation: ${orientation}`);
        
        if (!orientation || orientation === 1) {
          console.log(`✅ No rotation needed (orientation: ${orientation})`);
          processed++;
          continue;
        }
        
        // Calculate rotation angle based on orientation
        let rotationAngle = 0;
        switch (orientation) {
          case 3: rotationAngle = 180; break;
          case 6: rotationAngle = 90; break;
          case 8: rotationAngle = 270; break;
          default:
            console.log(`⚠️ Unknown orientation: ${orientation}, skipping...`);
            processed++;
            continue;
        }
        
        console.log(`🔄 Rotating by ${rotationAngle}°`);
        
        // Process all image sizes
        const sizes = [
          { bucket: 'images-64', path: item.path_64 },
          { bucket: 'images-512', path: item.path_512 },
          { bucket: 'images-2048', path: item.path_2048 }
        ];
        
        let sizeRotated = 0;
        
        for (const size of sizes) {
          if (!size.path) {
            console.log(`⚠️ No path for ${size.bucket}, skipping...`);
            continue;
          }
          
          try {
            // Download current image
            const { data: imageData, error: downloadError } = await supabase.storage
              .from(size.bucket)
              .download(size.path);
            
            if (downloadError) {
              console.error(`❌ Download error for ${size.bucket}/${size.path}:`, downloadError);
              continue;
            }
            
            // Rotate image
            const buffer = Buffer.from(await imageData.arrayBuffer());
            const rotatedBuffer = await sharp(buffer)
              .rotate(rotationAngle)
              .jpeg({ quality: 90 })
              .toBuffer();
            
            // Upload rotated image
            const { error: uploadError } = await supabase.storage
              .from(size.bucket)
              .upload(size.path, rotatedBuffer, {
                upsert: true,
                contentType: 'image/jpeg'
              });
            
            if (uploadError) {
              console.error(`❌ Upload error for ${size.bucket}/${size.path}:`, uploadError);
            } else {
              console.log(`✅ Rotated ${size.bucket}/${size.path}`);
              sizeRotated++;
            }
            
          } catch (err) {
            console.error(`❌ Error processing ${size.bucket}/${size.path}:`, err);
          }
        }
        
        if (sizeRotated > 0) {
          console.log(`✅ Successfully rotated ${sizeRotated} sizes for ${item.id}`);
          rotated++;
        }
        
        processed++;
        
      } catch (err) {
        console.error(`❌ Error processing item ${item.id}:`, err);
        errors++;
      }
    }
    
    console.log(`\n🎉 Migration complete!`);
    console.log(`📊 Results:`);
    console.log(`  - Processed: ${processed}`);
    console.log(`  - Rotated: ${rotated}`);
    console.log(`  - Errors: ${errors}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// CLI support
if (process.argv.length > 2) {
  const targetId = process.argv[2];
  console.log(`🎯 Running auto-rotate for specific item: ${targetId}`);
  autoRotateImages(targetId);
} else {
  console.log('🔄 Running auto-rotate for all items...');
  autoRotateImages();
} 