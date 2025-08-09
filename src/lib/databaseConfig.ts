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
    // Database function call (debug removed)
    
    const { data, error } = await supabase.rpc(functionName, params, { head: false });
    
    if (error) {
      console.error(`[Database] ${functionName} error:`, error);
      return { data: null, error };
    }
    
    // Database function success (debug removed)
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
  // Database operation logging disabled for performance
} 