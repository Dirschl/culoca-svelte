#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUploadedFiles() {
  try {
    console.log('🔍 Checking uploaded files in database...\n');
    
    // Get all images from database
    const { data: images, error } = await supabase
      .from('images')
      .select('id, original_name, created_at, user_id, profile_id')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Database error:', error);
      console.log('\n💡 This might be due to RLS policies. Try running this from the Supabase dashboard instead.');
      return;
    }
    
    console.log(`📊 Total images in database: ${images.length}\n`);
    
    if (images.length === 0) {
      console.log('No images found in database.');
      return;
    }
    
    console.log('📋 Uploaded files:');
    console.log('─'.repeat(80));
    
    images.forEach((image, index) => {
      const date = new Date(image.created_at).toLocaleString('de-DE');
      console.log(`${(index + 1).toString().padStart(3)}. ${image.original_name || 'Unknown'}`);
      console.log(`    ID: ${image.id}`);
      console.log(`    User: ${image.user_id || 'null'}`);
      console.log(`    Profile: ${image.profile_id || 'null'}`);
      console.log(`    Uploaded: ${date}`);
      console.log('');
    });
    
    // Group by user
    const userGroups = {};
    images.forEach(image => {
      const userId = image.user_id || 'unknown';
      if (!userGroups[userId]) {
        userGroups[userId] = [];
      }
      userGroups[userId].push(image);
    });
    
    console.log('👥 Images by user:');
    console.log('─'.repeat(80));
    Object.entries(userGroups).forEach(([userId, userImages]) => {
      console.log(`User ${userId}: ${userImages.length} images`);
    });
    
    // Check for recent uploads (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentUploads = images.filter(img => new Date(img.created_at) > oneDayAgo);
    console.log(`\n🕐 Recent uploads (last 24h): ${recentUploads.length}`);
    
    if (recentUploads.length > 0) {
      console.log('Recent files:');
      recentUploads.forEach(img => {
        const date = new Date(img.created_at).toLocaleString('de-DE');
        console.log(`  - ${img.original_name || 'Unknown'} (${date})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUploadedFiles(); 