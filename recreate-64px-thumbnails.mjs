import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://caskhmcbvtevdwsolvwk.supabase.co',
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function recreate64pxThumbnails() {
  console.log('🔧 Starting 64px thumbnail recreation with higher quality...');
  
  // Step 1: Get all images that have path_64 (existing 64px thumbnails)
  const { data: existingImages, error: fetchError } = await supabase
    .from('items')
    .select('id, path_512, path_64')
    .not('path_64', 'is', null);
    
  if (fetchError) {
    console.error('❌ Error fetching images:', fetchError);
    return;
  }
  
  console.log(`📸 Found ${existingImages.length} images with existing 64px thumbnails`);
  
  if (existingImages.length === 0) {
    console.log('✅ No existing 64px thumbnails found');
    return;
  }
  
  // Step 2: Delete existing 64px thumbnails from storage
  console.log('🗑️ Deleting existing 64px thumbnails from storage...');
  let deletedCount = 0;
  let skippedCount = 0;
  
  for (const image of existingImages) {
    try {
      // Skip if path_64 is null or empty
      if (!image.path_64) {
        console.log(`⏭️ Skipping ${image.id}: no path_64`);
        skippedCount++;
        continue;
      }
      
      const { error: deleteError } = await supabase.storage
        .from('images-64')
        .remove([image.path_64]);
        
      if (deleteError) {
        console.log(`⚠️ Failed to delete ${image.id} (${image.path_64}): ${deleteError.message}`);
        // Continue anyway - the file might not exist
      } else {
        console.log(`🗑️ Deleted ${image.id} (${image.path_64})`);
        deletedCount++;
      }
    } catch (err) {
      console.log(`⚠️ Error deleting ${image.id}: ${err.message}`);
      // Continue anyway - don't let one error stop the process
    }
  }
  
  console.log(`✅ Deleted ${deletedCount} existing 64px thumbnails, skipped ${skippedCount}`);
  
  // Step 3: Reset path_64 field in database
  console.log('🔄 Resetting path_64 field in database...');
  const { error: updateError } = await supabase
    .from('items')
    .update({ path_64: null })
    .not('path_64', 'is', null);
    
  if (updateError) {
    console.error('❌ Error resetting path_64:', updateError);
    return;
  }
  
  console.log('✅ Reset path_64 field for all images');
  
  // Step 4: Recreate 64px thumbnails with higher quality
  console.log('🔄 Recreating 64px thumbnails with 90% quality...');
  
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  for (const image of existingImages) {
    try {
      console.log(`🔍 Processing ${image.id}...`);
      
      // Download 512px image from Supabase storage
      const imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${image.path_512}`;
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        console.log(`❌ Failed to download ${image.id}: ${response.status}`);
        failed++;
        continue;
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Create 64px thumbnail with optimized quality and sharpening
      const thumbnail64 = await sharp(buffer)
        .resize(64, 64, { 
          fit: 'inside', 
          withoutEnlargement: true,
          kernel: 'lanczos3' // Better interpolation for small sizes
        })
        .sharpen(0.5, 1, 2) // Add sharpening for better detail
        .jpeg({ mozjpeg: true, quality: 95 }) // Higher quality
        .toBuffer();
      
      // Upload 64px thumbnail to storage
      const { error: uploadError } = await supabase.storage
        .from('images-64')
        .upload(image.path_512, thumbnail64, { 
          contentType: 'image/jpeg',
          upsert: true
        });
        
      if (uploadError) {
        console.log(`❌ Failed to upload 64px thumbnail for ${image.id}: ${uploadError.message}`);
        failed++;
        continue;
      }
      
      // Update database with path_64
      const { error: updateError } = await supabase
        .from('items')
        .update({ path_64: image.path_512 })
        .eq('id', image.id);
        
      if (updateError) {
        console.log(`❌ Failed to update database for ${image.id}: ${updateError.message}`);
        failed++;
        continue;
      }
      
      console.log(`✅ Successfully recreated 64px thumbnail for ${image.id}`);
      success++;
      
    } catch (err) {
      console.log(`❌ Error processing ${image.id}: ${err.message}`);
      failed++;
    }
    
    processed++;
    
    // Progress update
    if (processed % 5 === 0) {
      console.log(`📊 Progress: ${processed}/${existingImages.length} processed, ${success} success, ${failed} failed`);
    }
  }
  
  console.log(`\n🎉 64px thumbnail recreation complete!`);
  console.log(`📊 Results: ${processed} processed, ${success} success, ${failed} failed`);
  console.log(`📊 Storage: ${deletedCount} old thumbnails deleted, ${skippedCount} skipped, ${success} new thumbnails created`);
}

// Run the script
recreate64pxThumbnails().catch(console.error); 