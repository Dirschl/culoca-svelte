import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://caskhmcbvtevdwsolvwk.supabase.co',
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function recompress2048Images() {
  console.log('🔧 Starting 2048px image recompression with optimized settings...');
  
  // Get all images that have path_2048
  const { data: images, error: fetchError } = await supabase
    .from('items')
    .select('id, path_2048')
    .not('path_2048', 'is', null);
    
  if (fetchError) {
    console.error('❌ Error fetching images:', fetchError);
    return;
  }
  
  console.log(`📸 Found ${images.length} images with 2048px versions to recompress`);
  
  if (images.length === 0) {
    console.log('✅ No 2048px images found');
    return;
  }
  
  let processed = 0;
  let success = 0;
  let failed = 0;
  let totalSizeReduction = 0;
  
  for (const image of images) {
    try {
      console.log(`🔍 Processing ${image.id}...`);
      
      // Download original 2048px image from Supabase storage
      const imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${image.path_2048}`;
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        console.log(`❌ Failed to download ${image.id}: ${response.status}`);
        failed++;
        continue;
      }
      
      const originalBuffer = Buffer.from(await response.arrayBuffer());
      const originalSize = originalBuffer.length;
      console.log(`📊 Original size: ${(originalSize / 1024).toFixed(1)} KB`);
      
      // Recompress with optimized settings
      const recompressedBuffer = await sharp(originalBuffer)
        .jpeg({ 
          mozjpeg: true, 
          quality: 75, // Reduced from 85 to 75
          progressive: true, // Enable progressive JPEG
          chromaSubsampling: '4:2:0', // Optimize chroma subsampling
          trellisQuantisation: true, // Enable trellis quantization
          overshootDeringing: true, // Reduce ringing artifacts
          optimizeScans: true // Optimize scan order
        })
        .toBuffer();
      
      const newSize = recompressedBuffer.length;
      const sizeReduction = originalSize - newSize;
      const reductionPercent = ((sizeReduction / originalSize) * 100).toFixed(1);
      
      console.log(`📊 New size: ${(newSize / 1024).toFixed(1)} KB (${reductionPercent}% reduction)`);
      
      // Only upload if we achieved significant size reduction (more than 5%)
      if (sizeReduction > 0 && (sizeReduction / originalSize) > 0.05) {
        // Upload recompressed image
        const { error: uploadError } = await supabase.storage
          .from('images-2048')
          .upload(image.path_2048, recompressedBuffer, { 
            contentType: 'image/jpeg',
            upsert: true // Overwrite existing file
          });
          
        if (uploadError) {
          console.log(`❌ Failed to upload recompressed image for ${image.id}: ${uploadError.message}`);
          failed++;
          continue;
        }
        
        totalSizeReduction += sizeReduction;
        console.log(`✅ Successfully recompressed ${image.id} (${reductionPercent}% smaller)`);
        success++;
      } else {
        console.log(`⏭️ Skipping ${image.id} - insufficient size reduction (${reductionPercent}%)`);
      }
      
    } catch (err) {
      console.log(`❌ Error processing ${image.id}: ${err.message}`);
      failed++;
    }
    
    processed++;
    
    // Progress update
    if (processed % 10 === 0) {
      console.log(`📊 Progress: ${processed}/${images.length} processed, ${success} success, ${failed} failed`);
    }
  }
  
  console.log(`\n🎉 Recompression complete!`);
  console.log(`📊 Results:`);
  console.log(`   - Processed: ${processed} images`);
  console.log(`   - Success: ${success} images`);
  console.log(`   - Failed: ${failed} images`);
  console.log(`   - Total size reduction: ${(totalSizeReduction / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Average reduction: ${totalSizeReduction > 0 ? ((totalSizeReduction / success) / 1024).toFixed(1) : 0} KB per image`);
}

// Run the recompression
recompress2048Images().catch(console.error); 