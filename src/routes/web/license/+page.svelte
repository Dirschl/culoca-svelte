<script lang="ts">
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';
  import { LEMON_SQUEEZY_CUSTOMER_LINKS as ls } from '$lib/licensing/lemonSqueezyCustomerLinks';
  import {
    LICENSE_TIER_DESCRIPTIONS,
    LICENSE_TIER_LABELS
  } from '$lib/licensing/tiers';

  const externalLinkRel = 'noopener noreferrer';
</script>

<svelte:head>
  <title>Lizenzinformationen der DIRSCHL.com GmbH für culoca.com</title>
  <meta name="description" content="Culoca Bildlizenzen: Standard- und Erweiterte Lizenz, Kauf über Lemon Squeezy, Download im Konto, Lizenz-Tausch, Rückerstattung und nicht-kommerzielle Nutzung." />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <link rel="canonical" href="https://culoca.com/web/license" />
  
  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/culoca-icon.svg" />
  <link rel="icon" type="image/png" href="/culoca-icon.png" sizes="32x32" />
  <link rel="apple-touch-icon" href="/culoca-icon.png" sizes="180x180" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="Lizenzinformationen der DIRSCHL.com GmbH für culoca.com" />
  <meta property="og:description" content="Culoca Bildlizenzen: Standard- und Erweiterte Lizenz, Kauf über Lemon Squeezy, Download im Konto, Lizenz-Tausch, Rückerstattung und nicht-kommerzielle Nutzung." />
  <meta property="og:url" content="https://culoca.com/web/license" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DIRSCHL.com GmbH" />
  <meta property="og:locale" content="de_DE" />
  <meta property="og:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
  
  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Lizenzinformationen der DIRSCHL.com GmbH für culoca.com",
    "description": "Culoca Bildlizenzen: Standard- und Erweiterte Lizenz, Kauf über Lemon Squeezy, Download im Konto, Lizenz-Tausch, Rückerstattung und nicht-kommerzielle Nutzung.",
    "url": "https://culoca.com/web/license",
    "inLanguage": "de",
    "caption": "License Information for culoca.com, DIRSCHL.com GmbH",
    "keywords": "Lizenz, Urheberrecht, Copyright, Nutzungsbedingungen, Culoca, DIRSCHL.com GmbH, Fotografie, Bilder, kommerzielle Nutzung, Attribution, Fotografen, Rechtliche Hinweise, Bildlizenzen, Creative Commons, Nutzungsrechte",
    "author": {
      "@type": "Person",
      "name": "Johann Dirschl"
    },
    "contentLocation": {
      "@type": "Place",
      "name": "de_DE"
    },
    "image": {
      "@type": "ImageObject",
      "url": "https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg",
      "name": "culoca-see-you-local-entdecke-deine-umgebung.jpg"
    },
    "publisher": {
      "@type": "Organization",
      "name": "DIRSCHL.com GmbH",
      "url": "https://culoca.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://culoca.com/culoca-icon.svg"
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Waldberg 84",
        "addressLocality": "Reischach",
        "postalCode": "84571",
        "addressCountry": "DE"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+49-179-9766666",
        "email": "johann.dirschl@gmx.de"
      }
    }
  }
  </script>
</svelte:head>

<InfoPageLayout currentPage="license">
  <h1>Lizenzinformationen</h1>

  <p class="lead">
    Auf culoca.com können Sie einzelne Fotos für die <strong>kommerzielle Nutzung</strong> lizenzieren.
    Diese Seite erklärt transparent, was Sie kaufen, welche Rechte gelten und wie Zahlung, Rechnung,
    Lizenz-Tausch und Rückerstattung ablaufen.
  </p>

  <nav class="page-toc highlight-box" aria-label="Inhaltsverzeichnis">
    <h2 class="toc-title">Auf dieser Seite</h2>
    <ul>
      <li><a href="#sicher-kaufen">Sicher kaufen</a></li>
      <li><a href="#kommerziell">Kommerzielle Lizenzen</a></li>
      <li><a href="#vertragspartner">Vertragspartner</a></li>
      <li><a href="#tausch">Lizenz-Tausch</a></li>
      <li><a href="#zahlung">Zahlung &amp; Rechnung</a></li>
      <li><a href="#widerruf">Rückerstattung &amp; Widerruf</a></li>
      <li><a href="#nicht-kommerziell">Nicht-kommerzielle Nutzung</a></li>
      <li><a href="#kontakt">Kontakt</a></li>
    </ul>
  </nav>

  <div id="sicher-kaufen" class="highlight-box trust-box">
    <h2>Sicher kaufen — Ihre Rechte auf einen Blick</h2>
    <ul class="trust-list">
      <li><strong>Sichere Zahlung</strong> über Lemon Squeezy (Merchant of Record) — Karte, PayPal u. a.</li>
      <li><strong>Rechnung per E-Mail</strong> von Lemon Squeezy; jederzeit abrufbar unter
        <a href={ls.myOrders} rel={externalLinkRel}>Meine Bestellungen</a></li>
      <li><strong>Download dauerhaft</strong> in Ihrem Culoca-Konto unter
        <a href="/dashboard?section=licenses">Gekaufte Lizenzen</a></li>
      <li><strong>Falsches Bild?</strong> Unkomplizierter <a href="#tausch">Lizenz-Tausch</a> nach Kontaktaufnahme</li>
      <li><strong>Rückerstattung</strong> über Lemon Squeezy — Schritte und Links unter
        <a href="#widerruf">Rückerstattung &amp; Widerruf</a></li>
    </ul>
    <p class="trust-links">
      Lemon Squeezy:
      <a href={ls.buyerTerms} rel={externalLinkRel}>Käufer-AGB</a> ·
      <a href={ls.privacy} rel={externalLinkRel}>Datenschutz</a> ·
      <a href={ls.help} rel={externalLinkRel}>Hilfe &amp; Kontakt</a>
    </p>
  </div>

  <h2 id="kommerziell">Kommerzielle Bildlizenzen (Culoca Shop)</h2>

  <h3>Was Sie kaufen</h3>
  <p>
    Mit dem Kauf erwerben Sie ein <strong>nicht-exklusives, zeitlich unbegrenztes Nutzungsrecht</strong>
    an genau dem einen lizenzierten Foto — für <strong>eine Organisation bzw. ein Projekt</strong>.
    Das Urheberrecht verbleibt beim Fotografen; Sie erhalten die vertraglich beschriebene Nutzungslizenz.
    Der Download steht dauerhaft in Ihrem Culoca-Konto unter
    <a href="/dashboard?section=licenses">Konto → Gekaufte Lizenzen</a> bereit (erneuter Export jederzeit möglich).
  </p>

  <h3>Lizenzstufen</h3>
  <ul class="tier-list">
    <li>
      <strong>{LICENSE_TIER_LABELS.standard}:</strong>
      {LICENSE_TIER_DESCRIPTIONS.standard}
    </li>
    <li>
      <strong>{LICENSE_TIER_LABELS.extended}:</strong>
      {LICENSE_TIER_DESCRIPTIONS.extended}
    </li>
  </ul>
  <p>
    Preise werden pro Bild festgelegt (Standard- und Erweiterte Lizenz können je Bild unterschiedlich
    ausgewiesen sein). Details und Preis sehen Sie auf der jeweiligen Bildseite bzw. im Warenkorb vor dem Kauf.
  </p>

  <h3>Kaufablauf</h3>
  <ol>
    <li>Auf der Bildseite Lizenzstufe wählen und <strong>in den Warenkorb</strong> legen (auch mehrere Bilder möglich).</li>
    <li>Im <a href="/warenkorb">Warenkorb</a> prüfen und <strong>zur Kasse</strong> — Checkout bei Lemon Squeezy.</li>
    <li>Nach erfolgreicher Zahlung: Download-Rechte in <a href="/dashboard?section=licenses">Gekaufte Lizenzen</a>; Rechnung von Lemon Squeezy per E-Mail.</li>
  </ol>

  <h3>Erlaubt / nicht erlaubt (beide Stufen)</h3>
  <p><strong>Erlaubt</strong> (im Rahmen der gewählten Stufe): Nutzung gemäß Beschreibung oben, technische
    Anpassungen für den konkreten Einsatz (Zuschnitt, Größe, Format, leichte Farbkorrektur), sofern der
    Bildinhalt nicht entstellt wird.</p>
  <p><strong>Nicht erlaubt</strong> ohne separate Vereinbarung:</p>
  <ul>
    <li>Weiterveräußerung, Unterlizenzierung oder Angebot als Stock-Foto / Template</li>
    <li>Nutzung in einem anstößigen, diffamierenden oder irreführenden Zusammenhang</li>
    <li>Marken- oder Kennzeichenrechte Dritter werden durch die Lizenz nicht eingeholt — prüfen Sie Ihren Anwendungsfall</li>
    <li>Erkennbare Personen, private Grundstücke o. Ä.: ggf. sind zusätzliche Einwilligungen nötig (Verantwortung des Nutzers)</li>
  </ul>

  <h2 id="vertragspartner">Vertragspartner — wer ist wofür zuständig?</h2>
  <p>
    Beim Kauf einer Culoca-Bildlizenz sind zwei Ebenen zu unterscheiden — das schafft Klarheit und entspricht
    dem üblichen Merchant-of-Record-Modell:
  </p>
  <div class="highlight-box">
    <dl class="partner-list">
      <dt>Lemon Squeezy (Merchant of Record)</dt>
      <dd>
        Verkauf und Abrechnung des Kaufpreises, Zahlungsabwicklung, Rechnung, Umsatzsteuer/VAT,
        Rückerstattungen der Zahlung. Rechtliche Grundlage:
        <a href={ls.buyerTerms} rel={externalLinkRel}>Lemon Squeezy Käufer-AGB</a>.
      </dd>
      <dt>DIRSCHL.com GmbH / Culoca (Anbieter der Plattform)</dt>
      <dd>
        Einräumung der <strong>Nutzungslizenz</strong> am Foto gemäß gewählter Stufe (Standard oder Erweitert),
        Bereitstellung des Downloads im Culoca-Konto, Lizenz-Tausch auf Kulanz, technischer Support zu Lizenzen.
      </dd>
      <dt>Fotograf (Urheber)</dt>
      <dd>
        Urheber des Bildes; räumt über Culoca die beschriebene Nutzungslizenz ein. Das Urheberrecht
        verbleibt beim Fotografen.
      </dd>
    </dl>
  </div>

  <h2 id="tausch">Lizenz-Tausch (falsches Bild)</h2>
  <p>
    Haben Sie versehentlich das <strong>falsche Foto</strong> lizenziert, kontaktieren Sie uns — in der Regel
    tauschen wir die Lizenz <strong>unkompliziert</strong> gegen ein anderes Culoca-Bild um, wenn:
  </p>
  <ul>
    <li>der Kauf noch nicht produktiv genutzt wurde (kein Einsatz in veröffentlichten Medien, Druck, Werbung o. Ä.),</li>
    <li>das Ersatzbild dieselbe oder eine niedrigere Lizenzstufe hat, und</li>
    <li>der Antrag zeitnah nach dem Kauf erfolgt.</li>
  </ul>
  <p>
    Schreiben Sie dazu an
    <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a> mit
    <strong>Bestellnummer</strong> (aus der Lemon-Squeezy-Kaufbestätigung) und den gewünschten Bild-Links.
    Ein Tausch ist eine Kulanzregelung von Culoca/DIRSCHL.com GmbH und ersetzt kein gesetzliches Widerrufsrecht;
    bei berechtigten Rückerstattungen der Zahlung gilt der Abschnitt
    <a href="#widerruf">Rückerstattung &amp; Widerruf</a>.
  </p>

  <h2 id="zahlung">Zahlung, Rechnung &amp; Lemon Squeezy</h2>
  <p>
    Zahlungen für Culoca-Bildlizenzen werden ausschließlich über
    <strong><a href={ls.home} rel={externalLinkRel}>Lemon Squeezy</a></strong> abgewickelt.
    Auf Ihrer Kreditkarten- oder Kontoauszugszeile erscheint typischerweise ein Eintrag wie
    <em>LEMSQZY*</em> oder <em>Lemon Squeezy</em> — das ist der reguläre Händler des Zahlungsvorgangs.
    <a href={ls.chargeHelp} rel={externalLinkRel}>Mehr zu Abbuchungen von Lemon Squeezy</a>.
  </p>
  <ul>
    <li>Zahlungsabwicklung (Karte, PayPal u. a., je nach Land)</li>
    <li>Rechnungsstellung an Sie als Käufer (PDF per E-Mail)</li>
    <li>Umsatzsteuer / VAT nach Steuersitz des Käufers</li>
    <li>Käufer-Support und Rückerstattungsprozesse</li>
  </ul>

  <h3>Rechnung &amp; Bestellübersicht abrufen</h3>
  <ul class="resource-links">
    <li>
      <a href={ls.myOrders} rel={externalLinkRel}><strong>Meine Bestellungen (Lemon Squeezy)</strong></a> —
      alle Käufe über Lemon Squeezy; Anmeldung per Magic-Link an Ihre Checkout-E-Mail.
      <span class="link-hint">(<a href={ls.myOrdersDocs} rel={externalLinkRel}>Anleitung</a>)</span>
    </li>
    <li>
      <a href={ls.culocaBilling} rel={externalLinkRel}><strong>Culoca-Kundenbereich (Billing)</strong></a> —
      Bestell- und Rechnungsübersicht speziell für den Culoca-Store.
    </li>
    <li>
      <strong>Kaufbestätigung per E-Mail</strong> — enthält Bestellnummer, Rechnung und Links von Lemon Squeezy.
    </li>
  </ul>

  <p>
    Lemon Squeezy:
    <a href={ls.buyerTerms} rel={externalLinkRel}>Käufer-AGB</a>,
    <a href={ls.privacy} rel={externalLinkRel}>Datenschutz</a>,
    <a href={ls.help} rel={externalLinkRel}>Hilfe &amp; Kontakt</a>.
  </p>

  <h2 id="widerruf">Rückerstattung &amp; Widerruf</h2>
  <p>
    Die vollständige <strong><a href="/web/widerruf">Widerrufsbelehrung</a></strong> mit Musterformular
    finden Sie auf einer eigenen Seite. Kurzüberblick:
  </p>

  <h3>So beantragen Sie eine Rückerstattung</h3>
  <ol class="refund-steps">
    <li>
      <strong>Lizenz-Tausch statt Rückerstattung?</strong> Bei versehentlich falschem Bild zuerst
      <a href="#tausch">Lizenz-Tausch</a> prüfen — oft schneller als eine Rückbuchung.
    </li>
    <li>
      <strong>Technisches Problem</strong> (Download fehlt trotz Zahlung): zuerst
      <a href="/dashboard?section=licenses">Gekaufte Lizenzen</a> prüfen; bei anhaltendem Problem
      <a href="mailto:johann.dirschl@gmx.de">Culoca-Support</a> mit Bestellnummer kontaktieren.
    </li>
    <li>
      <strong>Rückerstattung der Zahlung</strong> über Lemon Squeezy:
      <ul>
        <li>Link in Ihrer <strong>Kaufbestätigungs-E-Mail</strong>, oder</li>
        <li><a href={ls.myOrders} rel={externalLinkRel}>Meine Bestellungen</a> bzw.
          <a href={ls.culocaBilling} rel={externalLinkRel}>Culoca-Kundenbereich</a>, oder</li>
        <li><a href={ls.help} rel={externalLinkRel}>Lemon Squeezy Hilfe &amp; Kontakt</a></li>
      </ul>
    </li>
    <li>
      Nach bestätigter Rückerstattung wird die Lizenz in Ihrem Culoca-Konto <strong>automatisch deaktiviert</strong>;
      weitere Downloads sind dann nicht mehr gestattet.
    </li>
  </ol>

  <div class="highlight-box">
    <h3 class="box-heading">Hinweis zu Rückerstattungen (Lemon Squeezy)</h3>
    <p>
      Rückerstattungen werden von Lemon Squeezy als Merchant of Record
      <strong>im Einzelfall nach deren Richtlinie</strong> bearbeitet — siehe
      <a href={ls.buyerTerms} rel={externalLinkRel}>Käufer-AGB, Abschnitt „Payment, Taxes and Refunds“</a>.
      Lemon Squeezy empfiehlt, zuerst den Anbieter (Culoca) zu kontaktieren; bei ungelösten Fällen
      <a href={ls.chargeHelp} rel={externalLinkRel}>Lemon Squeezy direkt</a>.
    </p>
  </div>

  <h3>Widerrufsrecht (EU-Verbraucher, digitale Inhalte)</h3>
  <p>
    Wenn Sie Verbraucher in der EU sind, steht Ihnen grundsätzlich ein <strong>14-tägiges Widerrufsrecht</strong> zu.
    Bei <strong>digitalen Inhalten mit sofortigem Zugriff</strong> (Download direkt nach Kauf) erlischt dieses Recht,
    sobald Sie dem Beginn der Ausführung ausdrücklich zugestimmt und zur Kenntnis genommen haben, dass Sie
    dadurch Ihr Widerrufsrecht verlieren — dies wird im <strong>Lemon-Squeezy-Checkout</strong> abgefragt
    (<a href={ls.buyerTerms} rel={externalLinkRel}>Käufer-AGB, „Digital Content“</a>).
  </p>
  <p>
    Unabhängig davon bieten wir den <a href="#tausch">Lizenz-Tausch</a> und prüfen berechtigte Anliegen
    kulant. Details: <a href="/web/widerruf">Widerrufsbelehrung</a>.
    Für Zahlungsrückbuchungen ohne vorherige Kontaktaufnahme verweisen wir auf die
    <a href={ls.buyerTerms} rel={externalLinkRel}>Lemon-Squeezy-Käufer-AGB</a> (Chargebacks).
  </p>

  <h2 id="nicht-kommerziell">Nicht-kommerzielle Nutzung (ohne Shop-Kauf)</h2>
  <p>
    Viele Bilder auf Culoca können für <strong>private, nicht-kommerzielle</strong> Zwecke genutzt werden,
    sofern auf der Bildseite nichts anderes angegeben ist. Dabei gilt:
  </p>

  <h3>Urheberrecht</h3>
  <p>
    Die Urheberrechte bleiben bei den jeweiligen Fotografen. Jedes Bild ist mit dem Namen des Fotografen gekennzeichnet.
  </p>

  <h3>Attribution</h3>
  <p>
    Bei jeder Nutzung soll der Name des Fotografen und ein Link zu Culoca angegeben werden —
    Format: „Foto: [Fotografenname] / Culoca.com“.
  </p>

  <h3>Kommerzielle Nutzung ohne Lizenz</h3>
  <p>
    Für werbliche, geschäftliche oder anderweitig <strong>kommerzielle</strong> Nutzung ist der Kauf einer
    Culoca-Bildlizenz (oben) erforderlich — nicht nur eine private Freigabe oder Attribution.
  </p>

  <h3>Einschränkungen</h3>
  <ul>
    <li>Keine entstellende oder irreführende Verwendung</li>
    <li>Keine Weiterveräußerung als Stock-Foto</li>
    <li>Abweichende Bedingungen auf der jeweiligen Bildseite haben Vorrang</li>
  </ul>

  <hr class="section-divider" />

  <div class="contact-info" id="kontakt">
    <h2>Kontakt</h2>
    <p>Fragen zu Lizenzen, Tausch oder kommerzieller Nutzung:</p>
    <ul>
      <li><strong>E-Mail:</strong> <a class="contact-link" href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></li>
      <li><strong>Telefon:</strong> <a class="contact-link" href="tel:+491799766666">+49 179 9766666</a></li>
    </ul>
    <p>
      <strong>Zahlung &amp; Rechnung:</strong>
      <a href={ls.myOrders} rel={externalLinkRel}>Lemon Squeezy — Meine Bestellungen</a> ·
      <a href={ls.help} rel={externalLinkRel}>Hilfe</a>
    </p>
    <p>
      Anbieter der Plattform: DIRSCHL.com GmbH —
      <a href="/web/impressum">Impressum</a>,
      <a href="/web/widerruf">Widerruf</a>,
      <a href="/web/datenschutz">Datenschutz</a>.
    </p>
  </div>

  <h2>Haftungsausschluss</h2>
  <p>
    Culoca übernimmt keine Haftung für die Nutzung der Bilder durch Dritte. Alle Nutzer sind verpflichtet,
    die geltenden Urheber- und Persönlichkeitsrechte zu beachten. Für die inhaltliche Richtigkeit von
    Metadaten oder die Eignung eines Bildes für einen bestimmten Zweck wird keine Gewähr übernommen.
  </p>

  <div class="warning-box">
    <h4>Rechtlicher Hinweis</h4>
    <p>
      Diese Seite fasst die wesentlichen Regeln für Culoca-Bildlizenzen zusammen. Maßgeblich für Ihren Kauf sind
      zusätzlich die im Checkout bestätigten
      <a href={ls.buyerTerms} rel={externalLinkRel}>Lemon-Squeezy-Käufer-AGB</a>,
      die gewählte Lizenzstufe sowie Hinweise auf der jeweiligen Bildseite.
      Stand: {new Date().getFullYear()}. Keine Rechtsberatung.
    </p>
  </div>
</InfoPageLayout>

<style>
  .lead {
    font-size: 1.05rem;
    max-width: 68ch;
    color: var(--text-secondary);
  }

  .tier-list {
    margin: 0.75rem 0 1rem;
    padding-left: 1.25rem;
  }

  .tier-list li {
    margin: 0.5rem 0;
  }

  .section-divider {
    margin: 2.5rem 0;
    border: none;
    border-top: 1px solid var(--border-color);
  }

  .page-toc {
    margin-top: 1.25rem;
  }

  .toc-title {
    font-size: 1rem;
    margin: 0 0 0.75rem;
    font-weight: 600;
  }

  .page-toc ul {
    margin: 0;
    padding-left: 1.25rem;
    columns: 2;
    column-gap: 2rem;
  }

  .page-toc li {
    margin: 0.35rem 0;
    break-inside: avoid;
  }

  .trust-box h2 {
    margin-top: 0;
    font-size: 1.15rem;
  }

  .trust-list {
    margin: 0.5rem 0 1rem;
    padding-left: 1.25rem;
  }

  .trust-list li {
    margin: 0.45rem 0;
  }

  .trust-links {
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .partner-list {
    margin: 0;
  }

  .partner-list dt {
    font-weight: 600;
    margin-top: 1rem;
  }

  .partner-list dt:first-child {
    margin-top: 0;
  }

  .partner-list dd {
    margin: 0.35rem 0 0;
    color: var(--text-secondary);
  }

  .resource-links {
    list-style: none;
    padding-left: 0;
    margin: 0.75rem 0 1.25rem;
  }

  .resource-links li {
    margin: 0.65rem 0;
    padding-left: 0;
  }

  .link-hint {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .refund-steps {
    padding-left: 1.35rem;
  }

  .refund-steps > li {
    margin: 0.65rem 0;
  }

  .box-heading {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  @media (max-width: 640px) {
    .page-toc ul {
      columns: 1;
    }
  }

  .contact-link {
    color: var(--text-secondary);
    transition: color 0.2s ease;
  }

  .contact-link:hover {
    color: #ee7221;
  }
</style>
