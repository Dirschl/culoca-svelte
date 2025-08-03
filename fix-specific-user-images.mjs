import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://caskhmcbvtevdwsolvwk.supabase.co',
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function fixSpecificUserImages(userId = null) {
  console.log('🔧 Starting EXIF orientation fix for specific user images...');
  
  // Get images for specific user or all users if no userId provided
  let query = supabase
    .from('items')
    .select('id, path_512, path_64, original_name, profile_id, exif_json')
    .not('path_512', 'is', null)
    .not('path_64', 'is', null);
  
  if (userId) {
    query = query.eq('profile_id', userId);
    console.log(`🎯 Targeting user: ${userId}`);
  }
  
  const { data: images, error } = await query;
    
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
  let userImages = {};
  
  for (const image of images) {
    try {
      // Group by user for better reporting
      const user = image.profile_id || 'unknown';
      if (!userImages[user]) {
        userImages[user] = { total: 0, fixed: 0, failed: 0 };
      }
      userImages[user].total++;
      
      console.log(`\n🔍 Processing ${image.id} (${image.original_name}) - User: ${user}...`);
      
      // Download original from Supabase storage
      const { data: originalData, error: downloadError } = await supabase.storage
        .from('originals')
        .download(image.path_512);
      
      if (downloadError) {
        console.log(`❌ Failed to download original for ${image.id}: ${downloadError.message}`);
        failed++;
        userImages[user].failed++;
        continue;
      }
      
      const originalBuffer = Buffer.from(await originalData.arrayBuffer());
      
      // Get metadata with EXIF orientation applied
      const sharpInstance = sharp(originalBuffer).rotate();
      const metadata = await sharpInstance.metadata();
      
      console.log(`📐 Original dimensions: ${metadata.width}x${metadata.height}`);
      console.log(`🔄 EXIF orientation: ${metadata.orientation || 'none'}`);
      
      // Check if orientation needs to be fixed
      if (metadata.orientation && metadata.orientation !== 1) {
        console.log(`🔄 Fixing orientation ${metadata.orientation}...`);
        orientationFixed++;
        userImages[user].fixed++;
      } else {
        console.log(`✅ No orientation fix needed`);
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
        userImages[user].failed++;
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
        userImages[user].failed++;
        continue;
      }
      
      console.log(`✅ Successfully fixed thumbnails for ${image.id}`);
      success++;
      
    } catch (err) {
      console.log(`❌ Error processing ${image.id}: ${err.message}`);
      failed++;
      if (image.profile_id) {
        if (!userImages[image.profile_id]) {
          userImages[image.profile_id] = { total: 0, fixed: 0, failed: 0 };
        }
        userImages[image.profile_id].failed++;
      }
    }
    
    processed++;
    
    // Progress update
    if (processed % 5 === 0) {
      console.log(`📊 Progress: ${processed}/${images.length} processed, ${success} success, ${failed} failed, ${orientationFixed} orientation fixes`);
    }
  }
  
  console.log(`\n🎉 EXIF orientation fix complete!`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Successfully processed: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   🔄 Orientation fixes applied: ${orientationFixed}`);
  console.log(`   📸 Total images: ${images.length}`);
  
  // User-specific results
  console.log(`\n👥 User-specific results:`);
  for (const [userId, stats] of Object.entries(userImages)) {
    console.log(`   User ${userId}: ${stats.total} total, ${stats.fixed} fixed, ${stats.failed} failed`);
  }
}

// Example usage:
// fixSpecificUserImages('user-id-here'); // For specific user
// fixSpecificUserImages(); // For all users

// Run the script for all users
fixSpecificUserImages().catch(console.error); 