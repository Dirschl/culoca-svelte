import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function POST() {
  try {
    console.log('🔧 Setting up gallery field...');

    // 1. Add gallery column to items table
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE items ADD COLUMN IF NOT EXISTS gallery BOOLEAN DEFAULT true;
      `
    });

    if (alterError) {
      console.error('Error adding gallery column:', alterError);
      return json({ error: 'Failed to add gallery column' }, { status: 500 });
    }

    // 2. Update existing items to have gallery = true
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE items SET gallery = true WHERE gallery IS NULL;
      `
    });

    if (updateError) {
      console.error('Error updating existing items:', updateError);
      return json({ error: 'Failed to update existing items' }, { status: 500 });
    }

    // 3. Create index for better performance
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_items_gallery ON items(gallery);
      `
    });

    if (indexError) {
      console.error('Error creating index:', indexError);
      return json({ error: 'Failed to create index' }, { status: 500 });
    }

    // 4. Update items_search_view to include gallery field
    const { error: viewError } = await supabase.rpc('exec_sql', {
      sql: `
        DROP VIEW IF EXISTS items_search_view;
        CREATE VIEW items_search_view AS
        SELECT 
          id, title, description, keywords, lat, lon, 
          path_512, path_2048, path_64, width, height, 
          created_at, user_id, profile_id, is_private, gallery,
          COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(keywords, '') AS search_text
        FROM items 
        WHERE path_512 IS NOT NULL;
      `
    });

    if (viewError) {
      console.error('Error updating items_search_view:', viewError);
      return json({ error: 'Failed to update items_search_view' }, { status: 500 });
    }

    // 5. Grant permissions
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql: `
        GRANT SELECT ON items_search_view TO authenticated;
        GRANT SELECT ON items_search_view TO anon;
      `
    });

    if (grantError) {
      console.error('Error granting permissions:', grantError);
      return json({ error: 'Failed to grant permissions' }, { status: 500 });
    }

    console.log('✅ Gallery field setup completed successfully');
    return json({ success: true, message: 'Gallery field setup completed' });

  } catch (error) {
    console.error('Error in gallery field setup:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
} 