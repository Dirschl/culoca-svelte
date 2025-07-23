import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const POST = async () => {
  try {
    console.log('Starting delete all images process...');

    // Get all images first
    const { data: images, error: fetchError } = await supabase
      .from('items')
      .select('id, path_512');

    if (fetchError) {
      throw new Error(`Failed to fetch images: ${fetchError.message}`);
    }

    if (!images || images.length === 0) {
      return json({ 
        status: 'success', 
        message: 'No images to delete',
        deletedCount: 0
      });
    }

    console.log(`Found ${images.length} images to delete`);

    // Extract file paths for storage deletion
    const filePaths = images.map(img => img.path_512).filter(Boolean);

    // Delete from storage
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('images-512')
        .remove(filePaths);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with database deletion even if storage fails
      } else {
        console.log(`Deleted ${filePaths.length} files from storage`);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition)

    if (deleteError) {
      throw new Error(`Failed to delete from database: ${deleteError.message}`);
    }

    console.log(`Successfully deleted all ${images.length} images`);

    return json({ 
      status: 'success', 
      message: `Successfully deleted ${images.length} images`,
      deletedCount: images.length
    });

  } catch (err) {
    console.error('Delete all error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Delete failed';
    return json({ 
      status: 'error', 
      message: errorMessage 
    }, { status: 500 });
  }
}; 