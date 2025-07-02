import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables');
  console.error('VITE_SUPABASE_URL:', !!process.env.VITE_SUPABASE_URL);
  console.error('VITE_SUPABASE_ANON_KEY:', !!process.env.VITE_SUPABASE_ANON_KEY);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// IDs of images without GPS data (failed uploads)
const failedImageIds = [
  '4617255f-4c47-4d17-85e2-ed15ca618727',
  'd793ab18-4043-4820-b372-738e57536797',
  'c7a0288f-a649-4de1-97fd-b34bf4c9079b',
  'cc5d4f00-3d77-4445-b433-4ee3325b3733',
  '822fa03b-e3aa-4879-a2d6-87ae7749b206'
];

async function cleanupFailedUploads() {
  console.log('Starting cleanup of failed uploads...');
  
  for (const imageId of failedImageIds) {
    console.log(`\nProcessing image: ${imageId}`);
    
    try {
      // Get image info from database
      const { data: image, error: fetchError } = await supabase
        .from('images')
        .select('path_512, path_2048')
        .eq('id', imageId)
        .single();
      
      if (fetchError) {
        console.error(`Error fetching image ${imageId}:`, fetchError);
        continue;
      }
      
      if (!image) {
        console.log(`Image ${imageId} not found in database`);
        continue;
      }
      
      console.log(`Found image with paths: 512px=${image.path_512}, 2048px=${image.path_2048}`);
      
      // Delete from storage (both sizes)
      const filesToDelete = [];
      if (image.path_512) filesToDelete.push(image.path_512);
      if (image.path_2048) filesToDelete.push(image.path_2048);
      
      if (filesToDelete.length > 0) {
        // Delete from images-512 bucket
        const { error: delete512Error } = await supabase.storage
          .from('images-512')
          .remove(filesToDelete);
        
        if (delete512Error) {
          console.error(`Error deleting from images-512:`, delete512Error);
        } else {
          console.log(`Deleted from images-512: ${filesToDelete.join(', ')}`);
        }
        
        // Delete from images-2048 bucket
        const { error: delete2048Error } = await supabase.storage
          .from('images-2048')
          .remove(filesToDelete);
        
        if (delete2048Error) {
          console.error(`Error deleting from images-2048:`, delete2048Error);
        } else {
          console.log(`Deleted from images-2048: ${filesToDelete.join(', ')}`);
        }
      }
      
      // Delete from database
      const { error: deleteDbError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId);
      
      if (deleteDbError) {
        console.error(`Error deleting from database:`, deleteDbError);
      } else {
        console.log(`Successfully deleted image ${imageId} from database`);
      }
      
    } catch (error) {
      console.error(`Error processing image ${imageId}:`, error);
    }
  }
  
  console.log('\nCleanup completed!');
}

// Run the cleanup
cleanupFailedUploads().catch(console.error); 