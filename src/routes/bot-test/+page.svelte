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

<div style="max-width: 800px; margin: 0 auto; padding: 2rem;">
  <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 1.5rem;">Bot-Test Tool</h1>
  
  <div style="background: #f3f4f6; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
    <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Aktueller Status</h2>
    <p><strong>User-Agent:</strong> {navigator.userAgent}</p>
    <p><strong>Bot-Modus:</strong> {isBotMode ? 'Aktiviert' : 'Deaktiviert'}</p>
  </div>
  
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
    <div style="background: #dbeafe; padding: 1rem; border-radius: 0.5rem;">
      <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Als Googlebot testen</h3>
      <p style="font-size: 0.875rem; margin-bottom: 0.75rem;">Simuliert den echten Googlebot User-Agent</p>
      <button 
        on:click={testAsGooglebot}
        style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer;"
      >
        Als Googlebot testen
      </button>
    </div>
    
    <div style="background: #dcfce7; padding: 1rem; border-radius: 0.5rem;">
      <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Als Bingbot testen</h3>
      <p style="font-size: 0.875rem; margin-bottom: 0.75rem;">Simuliert den echten Bingbot User-Agent</p>
      <button 
        on:click={testAsBingbot}
        style="background: #16a34a; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer;"
      >
        Als Bingbot testen
      </button>
    </div>
  </div>
  
  <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
    <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Bot-Modus aktivieren</h3>
    <p style="font-size: 0.875rem; margin-bottom: 0.75rem;">Aktiviert den Bot-Modus und lädt die Seite neu</p>
    <button 
      on:click={enableBotMode}
      style="background: #eab308; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; margin-right: 0.5rem;"
    >
      Bot-Modus aktivieren
    </button>
    <button 
      on:click={disableBotMode}
      style="background: #6b7280; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer;"
    >
      Normal-Modus wiederherstellen
    </button>
  </div>
  
  {#if testResults}
    <div style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem;">
      <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Test-Ergebnisse</h3>
      <pre style="font-size: 0.875rem;">{testResults}</pre>
    </div>
  {/if}
  
  <div style="margin-top: 2rem;">
    <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Anleitung</h2>
    <ol style="list-style-type: decimal; padding-left: 1.5rem;">
      <li style="margin-bottom: 0.5rem;">Klicke auf "Als Googlebot testen" um den echten Googlebot zu simulieren</li>
      <li style="margin-bottom: 0.5rem;">Gehe dann zu <a href="/" style="color: #3b82f6; text-decoration: underline;">culoca.com</a></li>
      <li style="margin-bottom: 0.5rem;">Prüfe in der Browser-Konsole die Bot-Erkennung</li>
      <li style="margin-bottom: 0.5rem;">Du solltest sehen: <code>[Bot-Debug] isBot: true</code></li>
      <li style="margin-bottom: 0.5rem;">Die Seite sollte feste GPS-Koordinaten verwenden (48.4167, 12.9333)</li>
    </ol>
  </div>
</div>
