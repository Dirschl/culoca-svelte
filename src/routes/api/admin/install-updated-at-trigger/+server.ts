import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { supabase } = await import('$lib/supabaseClient');
    
    // Step 1: Create the trigger function
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;

    // Step 2: Create the trigger
    const createTriggerSQL = `
      DROP TRIGGER IF EXISTS update_items_updated_at ON items;
      CREATE TRIGGER update_items_updated_at
          BEFORE UPDATE ON items
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `;

    // Step 3: Update existing items
    const updateItemsSQL = `
      UPDATE items 
      SET updated_at = created_at 
      WHERE updated_at IS NULL;
    `;

    // Execute the SQL statements using raw queries
    const results = [];
    
    // Create function
    const { error: functionError } = await supabase.rpc('exec_sql', { sql_query: createFunctionSQL });
    if (functionError) {
      console.error('Error creating function:', functionError);
      return json({ error: 'Failed to create trigger function', details: functionError }, { status: 500 });
    }
    results.push('Function created');

    // Create trigger
    const { error: triggerError } = await supabase.rpc('exec_sql', { sql_query: createTriggerSQL });
    if (triggerError) {
      console.error('Error creating trigger:', triggerError);
      return json({ error: 'Failed to create trigger', details: triggerError }, { status: 500 });
    }
    results.push('Trigger created');

    // Update existing items
    const { error: updateError } = await supabase.rpc('exec_sql', { sql_query: updateItemsSQL });
    if (updateError) {
      console.error('Error updating items:', updateError);
      return json({ error: 'Failed to update existing items', details: updateError }, { status: 500 });
    }
    results.push('Items updated');

    // Verify the results
    const { data: verifyData, error: verifyError } = await supabase
      .from('items')
      .select('updated_at')
      .limit(5);

    if (verifyError) {
      console.error('Error verifying:', verifyError);
    }

    return json({ 
      success: true, 
      message: 'Updated_at trigger installed successfully',
      results: results,
      sample_data: verifyData
    });
  } catch (error) {
    console.error('Error in install-updated-at-trigger:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 