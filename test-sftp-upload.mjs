import { Client } from 'ssh2';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function testSFTPUpload() {
  console.log('Testing Hetzner SFTP upload...');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('HETZNER_WEBDAV_URL:', process.env.HETZNER_WEBDAV_URL ? 'SET' : 'NOT SET');
  console.log('HETZNER_WEBDAV_USER:', process.env.HETZNER_WEBDAV_USER ? 'SET' : 'NOT SET');
  console.log('HETZNER_WEBDAV_PASSWORD:', process.env.HETZNER_WEBDAV_PASSWORD ? 'SET' : 'NOT SET');
  
  if (!process.env.HETZNER_WEBDAV_USER || !process.env.HETZNER_WEBDAV_PASSWORD) {
    console.error('❌ Missing required Hetzner environment variables');
    return;
  }
  
  // Extract hostname from WebDAV URL
  const hostname = process.env.HETZNER_WEBDAV_URL?.replace('https://', '').replace('http://', '');
  
  if (!hostname) {
    console.error('❌ Could not extract hostname from HETZNER_WEBDAV_URL');
    return;
  }
  
  console.log('Using hostname:', hostname);
  
  const conn = new Client();
  
  conn.on('ready', () => {
    console.log('✅ SSH connection established');
    
    conn.sftp((err, sftp) => {
      if (err) {
        console.error('❌ SFTP error:', err);
        conn.end();
        return;
      }
      
      console.log('✅ SFTP session started');
      
      // Test upload
      const testId = 'test-' + Date.now();
      const testPath = `/items/${testId}.jpg`;
      const testData = Buffer.from('test image data');
      
      console.log(`Testing upload to: ${testPath}`);
      
      const writeStream = sftp.createWriteStream(testPath);
      writeStream.write(testData);
      writeStream.end();
      
      writeStream.on('finish', () => {
        console.log('✅ Upload test successful');
        
        // Test download
        const readStream = sftp.createReadStream(testPath);
        let downloadedData = Buffer.alloc(0);
        
        readStream.on('data', (chunk) => {
          downloadedData = Buffer.concat([downloadedData, chunk]);
        });
        
        readStream.on('end', () => {
          console.log('✅ Download test successful');
          console.log('Downloaded data length:', downloadedData.length);
          
          // Clean up test file
          sftp.unlink(testPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('❌ Cleanup failed:', unlinkErr);
            } else {
              console.log('✅ Cleanup successful');
            }
            
            console.log('🎉 All Hetzner SFTP tests passed!');
            conn.end();
          });
        });
        
        readStream.on('error', (readErr) => {
          console.error('❌ Download test failed:', readErr);
          conn.end();
        });
      });
      
      writeStream.on('error', (writeErr) => {
        console.error('❌ Upload test failed:', writeErr);
        conn.end();
      });
    });
  });
  
  conn.on('error', (err) => {
    console.error('❌ SSH connection failed:', err);
  });
  
  conn.connect({
    host: hostname,
    port: 22,
    username: process.env.HETZNER_WEBDAV_USER,
    password: process.env.HETZNER_WEBDAV_PASSWORD
  });
}

testSFTPUpload(); 