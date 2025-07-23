import { supabase } from './supabaseClient';

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  // Get the current session and access token
  const { data } = await supabase.auth.getSession();
  const access_token = data.session?.access_token;

  console.log('🔐 authFetch - Session data:', { 
    hasSession: !!data.session, 
    hasAccessToken: !!access_token,
    url: input 
  });

  // Create headers object, merging with existing headers
  const headers = new Headers(init.headers || {});
  
  // Add Authorization header if we have an access token
  if (access_token) {
    headers.set('Authorization', `Bearer ${access_token}`);
    console.log('✅ authFetch - Added Authorization header');
  } else {
    console.log('❌ authFetch - No access token available');
  }

  // Return fetch with the modified headers
  return fetch(input, { 
    ...init, 
    headers 
  });
} 