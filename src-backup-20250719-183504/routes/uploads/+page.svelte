<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { authFetch } from '$lib/authFetch';
  let files: FileList;
  let uploadList = [];
  let loading = false;

  async function send() {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    
    // Get session and user
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (user) {
      fd.append('profile_id', user.id);
      
      // Load user settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('save_originals')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        fd.append('save_originals', profile.save_originals ? 'true' : 'false');
      } else {
        fd.append('save_originals', 'true');
      }
    }
    
    // Add Authorization header if session exists
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const res = await authFetch('/api/upload', { method: 'POST', body: fd, headers });
    alert(await res.text());
  }
</script>

<input type="file" bind:files multiple accept="image/*" />
<button on:click={send} class="bg-blue-600 text-white px-4 py-2 rounded">
  Hochladen
</button>
