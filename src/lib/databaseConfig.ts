import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Safely call a Supabase RPC function with error handling
 */
export async function safeFunctionCall(
  supabase: SupabaseClient,
  functionName: string,
  params: Record<string, any>
) {
  try {
    console.log(`[Database] Calling ${functionName} with params:`, params);
    
    const { data, error } = await supabase.rpc(functionName, params, { head: false });
    
    if (error) {
      console.error(`[Database] ${functionName} error:`, error);
      return { data: null, error };
    }
    
    console.log(`[Database] ${functionName} success, returned ${data?.length || 0} items`);
    return { data, error: null };
  } catch (error) {
    console.error(`[Database] Unexpected error in ${functionName}:`, error);
    return { data: null, error };
  }
}

/**
 * Log database operations for debugging
 */
export function logDatabaseOperation(operation: string, params?: Record<string, any>) {
  console.log(`[Database] ${operation}`, params ? `with params: ${JSON.stringify(params)}` : '');
} 