// Bot Test Browser Extension
// Speichere als .js Datei und lade in Browser als Bookmarklet

(function() {
  'use strict';
  
  // Original User-Agent speichern
  const originalUserAgent = navigator.userAgent;
  
  // Bot User-Agents
  const botUserAgents = {
    googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    duckduckbot: 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)',
    facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    twitter: 'Twitterbot/1.0',
    linkedin: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)'
  };
  
  // User-Agent ändern
  function setUserAgent(userAgent) {
    Object.defineProperty(navigator, 'userAgent', {
      value: userAgent,
      configurable: true
    });
    console.log('User-Agent geändert zu:', userAgent);
  }
  
  // Original User-Agent wiederherstellen
  function restoreUserAgent() {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
    console.log('Original User-Agent wiederhergestellt:', originalUserAgent);
  }
  
  // Bot-Modus aktivieren
  function enableBotMode(botType = 'googlebot') {
    const userAgent = botUserAgents[botType] || botUserAgents.googlebot;
    setUserAgent(userAgent);
    alert(`Bot-Modus aktiviert: ${botType}\nUser-Agent: ${userAgent}\n\nLade Seite neu für Test...`);
    setTimeout(() => window.location.reload(), 1000);
  }
  
  // Normal-Modus wiederherstellen
  function disableBotMode() {
    restoreUserAgent();
    alert('Normal-Modus wiederhergestellt.\n\nLade Seite neu...');
    setTimeout(() => window.location.reload(), 1000);
  }
  
  // UI erstellen
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 400px;
    width: 90%;
  `;
  
  content.innerHTML = `
    <h2 style="margin: 0 0 20px 0; color: #333;">Bot Test Tool</h2>
    <p style="margin: 0 0 15px 0; color: #666;">Wähle einen Bot-Typ zum Testen:</p>
    <div style="display: grid; gap: 10px; margin-bottom: 20px;">
      <button onclick="window.enableBotMode('googlebot')" style="padding: 10px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Als Googlebot testen</button>
      <button onclick="window.enableBotMode('bingbot')" style="padding: 10px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">Als Bingbot testen</button>
      <button onclick="window.enableBotMode('facebook')" style="padding: 10px; background: #1877f2; color: white; border: none; border-radius: 4px; cursor: pointer;">Als Facebook testen</button>
      <button onclick="window.enableBotMode('twitter')" style="padding: 10px; background: #1da1f2; color: white; border: none; border-radius: 4px; cursor: pointer;">Als Twitter testen</button>
    </div>
    <button onclick="window.disableBotMode()" style="padding: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Normal-Modus wiederherstellen</button>
    <button onclick="this.parentElement.parentElement.remove()" style="padding: 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 10px;">Schließen</button>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Globale Funktionen verfügbar machen
  window.enableBotMode = enableBotMode;
  window.disableBotMode = disableBotMode;
  
  console.log('Bot Test Tool geladen!');
  console.log('Verwende: enableBotMode("googlebot") oder disableBotMode()');
})();
