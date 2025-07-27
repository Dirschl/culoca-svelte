#!/usr/bin/env node

/**
 * Script to fix image orientation for existing images
 * This script re-processes images with EXIF orientation applied
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixImageOrientation() {
  console.log('🔄 Starting image orientation fix...');
  
  try {
    // Get all images from database
    const { data: images, error } = await supabase
      .from('items')
      .select('id, path_512, path_2048, path_64, width, height')
      .not('path_512', 'is', null)
      .limit(10); // Start with a small batch for testing
    
    if (error) {
      console.error('❌ Error fetching images:', error);
      return;
    }
    
    console.log(`📊 Found ${images.length} images to process`);
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      console.log(`\n[${i + 1}/${images.length}] Processing image: ${image.id}`);
      
      try {
        // Download original from originals bucket
        const { data: originalData, error: downloadError } = await supabase.storage
          .from('originals')
          .download(`${image.id}.jpg`);
        
        if (downloadError) {
          console.log(`⚠️  No original found for ${image.id}, skipping`);
          continue;
        }
        
        const originalBuffer = Buffer.from(await originalData.arrayBuffer());
        
        // Get correct dimensions after EXIF orientation
        const metadata = await sharp(originalBuffer).rotate().metadata();
        const correctWidth = metadata.width || image.width;
        const correctHeight = metadata.height || image.height;
        
        console.log(`📐 Original dimensions: ${image.width}x${image.height}`);
        console.log(`📐 Correct dimensions: ${correctWidth}x${correctHeight}`);
        
        // Only update if dimensions are different
        if (correctWidth !== image.width || correctHeight !== image.height) {
          console.log(`🔄 Updating dimensions for ${image.id}`);
          
          const { error: updateError } = await supabase
            .from('items')
            .update({
              width: correctWidth,
              height: correctHeight
            })
            .eq('id', image.id);
          
          if (updateError) {
            console.error(`❌ Error updating ${image.id}:`, updateError);
          } else {
            console.log(`✅ Updated dimensions for ${image.id}`);
          }
        } else {
          console.log(`✅ Dimensions already correct for ${image.id}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${image.id}:`, error);
      }
    }
    
    console.log('\n✅ Image orientation fix completed!');
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
fixImageOrientation().then(() => {
  console.log('🎉 Script finished');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
}); 