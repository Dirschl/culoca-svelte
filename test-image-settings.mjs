#!/usr/bin/env node

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import sharp from 'sharp';

// Load environment variables
dotenv.config();

// --- Helper Functions (copied from src/lib/image.ts) ---

function parseFormat(key, fallback) {
  const raw = process.env[key]?.toLowerCase();
  if (raw === 'webp') return 'webp';
  if (raw === 'jpeg' || raw === 'jpg') return 'jpg';
  return fallback;
}

function parseQuality(key, fallback) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const val = parseInt(raw, 10);
  if (Number.isFinite(val) && val >= 1 && val <= 100) return val;
  console.warn(`⚠️  Invalid value for ${key}: "${raw}" – using fallback ${fallback}`);
  return fallback;
}

function getImageQualitySettings() {
  const settings = {
    format2048: parseFormat('IMAGE_FORMAT_2048', 'jpg'),
    quality2048: parseQuality('IMAGE_QUALITY_2048', 85),
    format512: parseFormat('IMAGE_FORMAT_512', 'jpg'),
    quality512: parseQuality('IMAGE_QUALITY_512', 85),
    format64: parseFormat('IMAGE_FORMAT_64', 'jpg'),
    quality64: parseQuality('IMAGE_QUALITY_64', 85)
  };
  console.log('✅ Environment-based Qualitätseinstellungen:', settings);
  return settings;
}

// --- Test Function ---

async function testImageSettings() {
  console.log('🧪 Testing Image Quality Settings...\n');
  
  // Test 1: Environment Variables
  console.log('📋 Environment Variables:');
  console.log('IMAGE_FORMAT_2048:', process.env.IMAGE_FORMAT_2048 || 'NOT SET');
  console.log('IMAGE_QUALITY_2048:', process.env.IMAGE_QUALITY_2048 || 'NOT SET');
  console.log('IMAGE_FORMAT_512:', process.env.IMAGE_FORMAT_512 || 'NOT SET');
  console.log('IMAGE_QUALITY_512:', process.env.IMAGE_QUALITY_512 || 'NOT SET');
  console.log('IMAGE_FORMAT_64:', process.env.IMAGE_FORMAT_64 || 'NOT SET');
  console.log('IMAGE_QUALITY_64:', process.env.IMAGE_QUALITY_64 || 'NOT SET');
  console.log('');
  
  // Test 2: Parsed Settings
  console.log('⚙️ Parsed Settings:');
  const settings = getImageQualitySettings();
  console.log('');
  
  // Test 3: Test image processing (if test.jpg exists)
  try {
    const testImagePath = 'test.jpg';
    const buffer = readFileSync(testImagePath);
    console.log(`📸 Testing with ${testImagePath} (${buffer.length} bytes)`);
    
    const metadata = await sharp(buffer).metadata();
    console.log(`Original: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    
    // Test different formats and qualities
    const tests = [
      { size: '2048x2048', format: settings.format2048, quality: settings.quality2048 },
      { size: '512x512', format: settings.format512, quality: settings.quality512 },
      { size: '64x64', format: settings.format64, quality: settings.quality64 }
    ];
    
    for (const test of tests) {
      const [width, height] = test.size.split('x').map(Number);
      
      let processedBuffer;
      if (test.format === 'webp') {
        processedBuffer = await sharp(buffer)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: test.quality, effort: 6, smartSubsample: true })
          .toBuffer();
      } else {
        processedBuffer = await sharp(buffer)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ 
            mozjpeg: true, 
            quality: test.quality,
            progressive: true,
            chromaSubsampling: '4:2:0',
            trellisQuantisation: true,
            overshootDeringing: true,
            optimizeScans: true
          })
          .toBuffer();
      }
      
      const reduction = ((buffer.length - processedBuffer.length) / buffer.length * 100).toFixed(1);
      console.log(`${test.size} ${test.format} Q${test.quality}: ${processedBuffer.length} bytes (${reduction}% reduction)`);
    }
    
  } catch (error) {
    console.log('⚠️ No test.jpg found, skipping image processing test');
    console.log('   You can add a test.jpg file to test actual image processing');
  }
  
  console.log('\n✅ Test completed!');
}

// Run the test
testImageSettings().catch(console.error); 