<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let isBotMode = false;
  let originalUserAgent = '';
  let testResults = '';
  
  onMount(() => {
    if (browser) {
      originalUserAgent = navigator.userAgent;
    }
  });
  
  function enableBotMode() {
    if (browser) {
      // Simuliere Googlebot User-Agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        configurable: true
      });
      isBotMode = true;
      testResults = 'Bot-Modus aktiviert. Lade Seite neu...';
      
      // Reload page after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }
  
  function disableBotMode() {
    if (browser) {
      // Restore original User-Agent
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true
      });
      isBotMode = false;
      testResults = 'Normal-Modus wiederhergestellt. Lade Seite neu...';
      
      // Reload page after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }
  
  function testAsGooglebot() {
    if (browser) {
      // Simuliere Googlebot User-Agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        configurable: true
      });
      testResults = 'Als Googlebot getestet. User-Agent: ' + navigator.userAgent;
    }
  }
  
  function testAsBingbot() {
    if (browser) {
      // Simuliere Bingbot User-Agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        configurable: true
      });
      testResults = 'Als Bingbot getestet. User-Agent: ' + navigator.userAgent;
    }
  }
</script>

<svelte:head>
  <title>Bot Test - Culoca</title>
  <meta name="description" content="Test-Seite für Bot-Erkennung" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <h1 class="text-3xl font-bold mb-6">Bot-Test Tool</h1>
  
  <div class="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg mb-6">
    <h2 class="text-xl font-semibold mb-4">Aktueller Status</h2>
    <p><strong>User-Agent:</strong> {navigator.userAgent}</p>
    <p><strong>Bot-Modus:</strong> {isBotMode ? 'Aktiviert' : 'Deaktiviert'}</p>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    <div class="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg">
      <h3 class="text-lg font-semibold mb-2">Als Googlebot testen</h3>
      <p class="text-sm mb-3">Simuliert den echten Googlebot User-Agent</p>
      <button 
        on:click={testAsGooglebot}
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
      >
        Als Googlebot testen
      </button>
    </div>
    
    <div class="bg-green-100 dark:bg-green-900 p-4 rounded-lg">
      <h3 class="text-lg font-semibold mb-2">Als Bingbot testen</h3>
      <p class="text-sm mb-3">Simuliert den echten Bingbot User-Agent</p>
      <button 
        on:click={testAsBingbot}
        class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
      >
        Als Bingbot testen
      </button>
    </div>
  </div>
  
  <div class="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg mb-6">
    <h3 class="text-lg font-semibold mb-2">Bot-Modus aktivieren</h3>
    <p class="text-sm mb-3">Aktiviert den Bot-Modus und lädt die Seite neu</p>
    <button 
      on:click={enableBotMode}
      class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded mr-2"
    >
      Bot-Modus aktivieren
    </button>
    <button 
      on:click={disableBotMode}
      class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
    >
      Normal-Modus wiederherstellen
    </button>
  </div>
  
  {#if testResults}
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
      <h3 class="text-lg font-semibold mb-2">Test-Ergebnisse</h3>
      <pre class="text-sm">{testResults}</pre>
    </div>
  {/if}
  
  <div class="mt-8">
    <h2 class="text-xl font-semibold mb-4">Anleitung</h2>
    <ol class="list-decimal list-inside space-y-2">
      <li>Klicke auf "Als Googlebot testen" um den echten Googlebot zu simulieren</li>
      <li>Gehe dann zu <a href="/" class="text-blue-500 hover:underline">culoca.com</a></li>
      <li>Prüfe in der Browser-Konsole die Bot-Erkennung</li>
      <li>Du solltest sehen: <code>[Bot-Debug] isBot: true</code></li>
      <li>Die Seite sollte feste GPS-Koordinaten verwenden (48.4167, 12.9333)</li>
    </ol>
  </div>
</div>
