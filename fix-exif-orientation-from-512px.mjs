import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://caskhmcbvtevdwsolvwk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhc2tobWNidnRldmR3c29sdndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU0NDcsImV4cCI6MjA2Njg5MTQ0N30.hSsjiOm2P9njyNhpzKzBpUlSyMr6YjqH39yMaUyYF6s'
);

async function fixExifOrientationFrom512px() {
  console.log('🔧 Starting EXIF orientation fix using 512px versions as source...');
  
  // Get all images that have both 512px and 64px thumbnails
  const { data: images, error } = await supabase
    .from('items')
    .select('id, path_512, path_64, original_name')
    .not('path_512', 'is', null)
    .not('path_64', 'is', null);
    
  if (error) {
    console.error('❌ Error fetching images:', error);
    return;
  }
  
  console.log(`📸 Found ${images.length} images with existing thumbnails`);
  
  if (images.length === 0) {
    console.log('✅ No images found with thumbnails');
    return;
  }
  
  let processed = 0;
  let success = 0;
  let failed = 0;
  let orientationFixed = 0;
  let skipped = 0;
  
  for (const image of images) {
    try {
      console.log(`\n🔍 Processing ${image.id} (${image.original_name})...`);
      
      // We'll check orientation from the image metadata itself
      console.log(`🔄 Processing image for orientation check...`);
      
      // Download 512px version from Supabase storage
      const { data: image512Data, error: downloadError } = await supabase.storage
        .from('images-512')
        .download(image.path_512);
      
      if (downloadError) {
        console.log(`❌ Failed to download 512px version for ${image.id}: ${downloadError.message}`);
        failed++;
        continue;
      }
      
      const image512Buffer = Buffer.from(await image512Data.arrayBuffer());
      
      // Get metadata with EXIF orientation applied
      const sharpInstance = sharp(image512Buffer).rotate();
      const metadata = await sharpInstance.metadata();
      
      console.log(`📐 512px dimensions: ${metadata.width}x${metadata.height}`);
      console.log(`🔄 EXIF orientation: ${metadata.orientation || 'none'}`);
      
      // Check if orientation needs to be fixed
      if (metadata.orientation && metadata.orientation !== 1) {
        console.log(`🔄 Fixing orientation ${metadata.orientation}...`);
        orientationFixed++;
      } else {
        console.log(`✅ No orientation fix needed`);
        skipped++;
        processed++;
        continue;
      }
      
      // Create 512px thumbnail with correct orientation
      const thumbnail512 = await sharpInstance
        .resize(512, 512, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ mozjpeg: true, quality: 85 })
        .toBuffer();
      
      // Create 64px thumbnail with correct orientation
      const thumbnail64 = await sharpInstance
        .resize(64, 64, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ mozjpeg: true, quality: 85 })
        .toBuffer();
      
      // Upload 512px thumbnail to storage
      const { error: upload512Error } = await supabase.storage
        .from('images-512')
        .upload(image.path_512, thumbnail512, { 
          contentType: 'image/jpeg',
          upsert: true
        });
        
      if (upload512Error) {
        console.log(`❌ Failed to upload 512px thumbnail for ${image.id}: ${upload512Error.message}`);
        failed++;
        continue;
      }
      
      // Upload 64px thumbnail to storage
      const { error: upload64Error } = await supabase.storage
        .from('images-64')
        .upload(image.path_64, thumbnail64, { 
          contentType: 'image/jpeg',
          upsert: true
        });
        
      if (upload64Error) {
        console.log(`❌ Failed to upload 64px thumbnail for ${image.id}: ${upload64Error.message}`);
        failed++;
        continue;
      }
      
      console.log(`✅ Successfully fixed thumbnails for ${image.id}`);
      success++;
      
    } catch (err) {
      console.log(`❌ Error processing ${image.id}: ${err.message}`);
      failed++;
    }
    
    processed++;
    
    // Progress update
    if (processed % 5 === 0) {
      console.log(`📊 Progress: ${processed}/${images.length} processed, ${success} success, ${failed} failed, ${orientationFixed} orientation fixes, ${skipped} skipped`);
    }
  }
  
  console.log(`\n🎉 EXIF orientation fix complete!`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Successfully processed: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   🔄 Orientation fixes applied: ${orientationFixed}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   📸 Total images: ${images.length}`);
}

// Run the script
fixExifOrientationFrom512px().catch(console.error); 