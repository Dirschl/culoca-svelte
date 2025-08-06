import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://caskhmcbvtevdwsolvwk.supabase.co',
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function create64pxThumbnails() {
  console.log('🔧 Starting 64px thumbnail generation...');
  
  // Get all images from database that don't have path_64 yet
  const { data: images, error } = await supabase
    .from('items')
    .select('id, path_512, path_64')
    .is('path_64', null);
    
  if (error) {
    console.error('❌ Error fetching images:', error);
    return;
  }
  
  console.log(`📸 Found ${images.length} images without 64px thumbnails`);
  
  if (images.length === 0) {
    console.log('✅ All images already have 64px thumbnails');
    return;
  }
  
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  for (const image of images) {
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
      
      // Create 64px thumbnail
      const thumbnail64 = await sharp(buffer)
        .resize(64, 64, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ mozjpeg: true, quality: 90 })
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
      
      console.log(`✅ Successfully created 64px thumbnail for ${image.id}`);
      success++;
      
    } catch (err) {
      console.log(`❌ Error processing ${image.id}: ${err.message}`);
      failed++;
    }
    
    processed++;
    
    // Progress update
    if (processed % 5 === 0) {
      console.log(`📊 Progress: ${processed}/${images.length} processed, ${success} success, ${failed} failed`);
    }
  }
  
  console.log(`\n🎉 Thumbnail generation complete!`);
  console.log(`📊 Results: ${processed} processed, ${success} success, ${failed} failed`);
}

// Run the script
create64pxThumbnails().catch(console.error); 