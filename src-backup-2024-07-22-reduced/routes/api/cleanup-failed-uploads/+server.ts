import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

// IDs of images without GPS data (failed uploads)
const failedImageIds = [
  '4617255f-4c47-4d17-85e2-ed15ca618727',
  'd793ab18-4043-4820-b372-738e57536797',
  'c7a0288f-a649-4de1-97fd-b34bf4c9079b',
  'cc5d4f00-3d77-4445-b433-4ee3325b3733',
  '822fa03b-e3aa-4879-a2d6-87ae7749b206'
];

export const POST = async () => {
  try {
    console.log('Starting cleanup of failed uploads...');
    const results = [];
    
    for (const imageId of failedImageIds) {
      console.log(`\nProcessing image: ${imageId}`);
      
      try {
        // Get image info from database
        const { data: image, error: fetchError } = await supabase
          .from('items')
          .select('path_512, path_2048')
          .eq('id', imageId)
          .single();
        
        if (fetchError) {
          console.error(`Error fetching image ${imageId}:`, fetchError);
          results.push({ id: imageId, status: 'error', message: fetchError.message });
          continue;
        }
        
        if (!image) {
          console.log(`Image ${imageId} not found in database`);
          results.push({ id: imageId, status: 'not_found' });
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
          .from('items')
          .delete()
          .eq('id', imageId);
        
        if (deleteDbError) {
          console.error(`Error deleting from database:`, deleteDbError);
          results.push({ id: imageId, status: 'error', message: deleteDbError.message });
        } else {
          console.log(`Successfully deleted image ${imageId} from database`);
          results.push({ id: imageId, status: 'deleted' });
        }
        
      } catch (error) {
        console.error(`Error processing image ${imageId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ id: imageId, status: 'error', message: errorMessage });
      }
    }
    
    console.log('\nCleanup completed!');
    return json({ 
      status: 'success', 
      message: 'Cleanup completed',
      results 
    });

  } catch (err) {
    console.error('Cleanup error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Cleanup failed';
    return json({ 
      status: 'error', 
      message: errorMessage 
    }, { status: 500 });
  }
}; 