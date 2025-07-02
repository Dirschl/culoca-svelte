<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  let files: FileList;
  let uploadList = [];
  let loading = false;

  async function send() {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      fd.append('profile_id', user.id);
    }
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    alert(await res.text());
  }
</script>

<input type="file" bind:files multiple accept="image/*" />
<button on:click={send} class="bg-blue-600 text-white px-4 py-2 rounded">
  Hochladen
</button>
