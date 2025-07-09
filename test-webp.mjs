import sharp from 'sharp';
import fs from 'fs';

async function testWebP() {
  console.log('Testing WebP generation...');
  
  // Create a simple test image
  const testBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
  .jpeg()
  .toBuffer();
  
  console.log('Created test image, size:', testBuffer.length);
  
  // Test WebP generation
  try {
    const webpBuffer = await sharp(testBuffer)
      .resize(512, 512)
      .webp({ 
        quality: 50,
        effort: 6
      })
      .toBuffer();
    
    console.log('✅ WebP generation successful!');
    console.log('WebP size:', webpBuffer.length);
    console.log('WebP first 10 bytes:', webpBuffer.slice(0, 10));
    
    // Check if it's actually WebP (should start with RIFF)
    if (webpBuffer.slice(0, 4).toString() === 'RIFF') {
      console.log('✅ Confirmed: Generated file is WebP format');
    } else {
      console.log('❌ Error: Generated file is not WebP format');
    }
    
  } catch (error) {
    console.error('❌ WebP generation failed:', error);
  }
}

testWebP(); 