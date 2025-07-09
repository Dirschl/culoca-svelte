import { createClient } from 'webdav';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function testHetznerUpload() {
  console.log('Testing Hetzner WebDAV upload...');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('HETZNER_WEBDAV_URL:', process.env.HETZNER_WEBDAV_URL ? 'SET' : 'NOT SET');
  console.log('HETZNER_WEBDAV_USER:', process.env.HETZNER_WEBDAV_USER ? 'SET' : 'NOT SET');
  console.log('HETZNER_WEBDAV_PASSWORD:', process.env.HETZNER_WEBDAV_PASSWORD ? 'SET' : 'NOT SET');
  console.log('HETZNER_WEBDAV_PUBLIC_URL:', process.env.HETZNER_WEBDAV_PUBLIC_URL ? 'SET' : 'NOT SET');
  
  if (!process.env.HETZNER_WEBDAV_URL || !process.env.HETZNER_WEBDAV_USER || !process.env.HETZNER_WEBDAV_PASSWORD) {
    console.error('❌ Missing required Hetzner environment variables');
    return;
  }
  
  // Try different URL formats
  const urlFormats = [
    process.env.HETZNER_WEBDAV_URL,
    process.env.HETZNER_WEBDAV_URL.replace('https://', 'https://u472664:W7)Ck&Xf9TZbR9n@'),
    process.env.HETZNER_WEBDAV_URL + '/webdav',
    process.env.HETZNER_WEBDAV_URL + '/dav'
  ];
  
  for (let i = 0; i < urlFormats.length; i++) {
    const testUrl = urlFormats[i];
    console.log(`\n--- Testing URL format ${i + 1}: ${testUrl} ---`);
    
    try {
      // Create WebDAV client
      const webdav = createClient(
        testUrl,
        {
          username: process.env.HETZNER_WEBDAV_USER,
          password: process.env.HETZNER_WEBDAV_PASSWORD
        }
      );
      
      // Test connection
      console.log('Testing WebDAV connection...');
      const contents = await webdav.getDirectoryContents('/');
      console.log('✅ WebDAV connection successful');
      console.log('Root directory contents:', contents.map(item => item.filename));
      
      // Test upload
      const testId = 'test-' + Date.now();
      const testPath = `/items/${testId}.jpg`;
      const testData = Buffer.from('test image data');
      
      console.log(`Testing upload to: ${testPath}`);
      await webdav.putFileContents(testPath, testData, { overwrite: true });
      console.log('✅ Upload test successful');
      
      // Test download
      const downloadedData = await webdav.getFileContents(testPath);
      console.log('✅ Download test successful');
      console.log('Downloaded data length:', downloadedData.length);
      
      // Clean up test file
      await webdav.deleteFile(testPath);
      console.log('✅ Cleanup successful');
      
      console.log('🎉 All Hetzner WebDAV tests passed with URL format', i + 1);
      return; // Success, exit
      
    } catch (error) {
      console.error(`❌ Hetzner WebDAV test failed with URL format ${i + 1}:`, error.message);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status
      });
    }
  }
  
  console.error('❌ All URL formats failed');
}

testHetznerUpload(); 