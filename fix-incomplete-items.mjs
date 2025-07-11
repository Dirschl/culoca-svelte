import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixIncompleteItems() {
  console.log('🔍 Searching for incomplete items...');
  
  // Find items missing path_2048 but have path_512 (your case)
  const { data: incompleteItems, error } = await supabase
    .from('items')
    .select('*')
    .not('path_512', 'is', null)
    .is('path_2048', null);
  
  if (error) {
    console.error('❌ Error fetching incomplete items:', error);
    return;
  }
  
  console.log(`📊 Found ${incompleteItems.length} incomplete items`);
  
  if (incompleteItems.length === 0) {
    console.log('✅ No incomplete items found!');
    return;
  }
  
  let fixed = 0;
  let failed = 0;
  
  for (const item of incompleteItems) {
    console.log(`\n🔧 Processing item: ${item.id} (${item.original_name})`);
    
    try {
      // Try to download the 512px version to recreate 2048px
      const { data: imageData, error: downloadError } = await supabase.storage
        .from('images-512')
        .download(item.path_512);
      
      if (downloadError) {
        console.error(`❌ Failed to download 512px version: ${downloadError.message}`);
        failed++;
        continue;
      }
      
      // Convert to buffer
      const buffer = Buffer.from(await imageData.arrayBuffer());
      
      // Create 2048px version from 512px (upscale if needed)
      const resized2048 = await sharp(buffer)
        .resize(2048, 2048, { 
          fit: 'inside',
          withoutEnlargement: false // Allow upscaling from 512px
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      // Generate 2048px filename
      const filename2048 = item.path_512.replace('.jpg', '_2048.jpg');
      
      // Upload 2048px version
      const { error: uploadError } = await supabase.storage
        .from('images-2048')
        .upload(filename2048, resized2048, {
          contentType: 'image/jpeg',
          upsert: false
        });
      
      if (uploadError) {
        console.error(`❌ Failed to upload 2048px version: ${uploadError.message}`);
        failed++;
        continue;
      }
      
      // Update database record
      const { error: updateError } = await supabase
        .from('items')
        .update({ path_2048: filename2048 })
        .eq('id', item.id);
      
      if (updateError) {
        console.error(`❌ Failed to update database: ${updateError.message}`);
        failed++;
        continue;
      }
      
      console.log(`✅ Successfully fixed item: ${item.id}`);
      fixed++;
      
    } catch (err) {
      console.error(`❌ Error processing item ${item.id}:`, err);
      failed++;
    }
  }
  
  console.log(`\n🎉 Fix complete!`);
  console.log(`📊 Results:`);
  console.log(`   - Fixed: ${fixed} items`);
  console.log(`   - Failed: ${failed} items`);
  console.log(`   - Total: ${incompleteItems.length} items`);
}

fixIncompleteItems().catch(console.error); 