<script lang="ts">
  let files: FileList;
  let uploadList = [];
  let loading = false;

  async function send() {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    alert(await res.text());
  }
</script>

<input type="file" bind:files multiple accept="image/*" />
<button on:click={send} class="bg-blue-600 text-white px-4 py-2 rounded">
  Hochladen
</button>
