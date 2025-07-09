import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://caskhmcbvtevdwsolvwk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhc2tobWNidnRldmR3c29sdndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU0NDcsImV4cCI6MjA2Njg5MTQ0N30.hSsjiOm2P9njyNhpzKzBpUlSyMr6YjqH39yMaUyYF6s'
);

async function fixImageDimensions() {
  console.log('🔧 Starting dimension migration...');
  
  // Get all images from database
  const { data: images, error } = await supabase
    .from('items')
    .select('id, path_512, width, height');
    
  if (error) {
    console.error('❌ Error fetching images:', error);
    return;
  }
  
  console.log(`📸 Found ${images.length} images to process`);
  
  let processed = 0;
  let fixed = 0;
  
  for (const image of images) {
    try {
      // Skip if dimensions look correct (not 512x512)
      if (image.width !== 512 || image.height !== 512) {
        console.log(`✅ Skipping ${image.id} - dimensions already correct (${image.width}x${image.height})`);
        continue;
      }
      
      console.log(`🔍 Processing ${image.id}...`);
      
      // Download image from Supabase storage
      const imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${image.path_512}`;
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        console.log(`❌ Failed to download ${image.id}: ${response.status}`);
        continue;
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Get actual dimensions
      const metadata = await sharp(buffer).metadata();
      const actualWidth = metadata.width;
      const actualHeight = metadata.height;
      
      if (!actualWidth || !actualHeight) {
        console.log(`❌ Failed to get dimensions for ${image.id}`);
        continue;
      }
      
      // Update database with correct dimensions
      const { error: updateError } = await supabase
        .from('items')
        .update({ 
          width: actualWidth, 
          height: actualHeight 
        })
        .eq('id', image.id);
        
      if (updateError) {
        console.log(`❌ Failed to update ${image.id}: ${updateError.message}`);
        continue;
      }
      
      console.log(`✅ Fixed ${image.id}: ${actualWidth}x${actualHeight} (was ${image.width}x${image.height})`);
      fixed++;
      
    } catch (err) {
      console.log(`❌ Error processing ${image.id}: ${err.message}`);
    }
    
    processed++;
    
    // Progress update
    if (processed % 5 === 0) {
      console.log(`📊 Progress: ${processed}/${images.length} processed, ${fixed} fixed`);
    }
  }
  
  console.log(`\n🎉 Migration complete!`);
  console.log(`📊 Total processed: ${processed}`);
  console.log(`✅ Successfully fixed: ${fixed}`);
}

// Run the migration
fixImageDimensions().catch(console.error); 