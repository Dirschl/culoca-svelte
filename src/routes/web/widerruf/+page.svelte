<script lang="ts">
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';
  import { LEMON_SQUEEZY_CUSTOMER_LINKS as ls } from '$lib/licensing/lemonSqueezyCustomerLinks';

  const externalLinkRel = 'noopener noreferrer';
</script>

<svelte:head>
  <title>Widerrufsbelehrung — Culoca Bildlizenzen</title>
  <meta
    name="description"
    content="Widerrufsbelehrung für den Kauf von Culoca-Bildlizenzen: 14-Tage-Widerrufsrecht, Ausnahmen bei digitalen Inhalten, Rückerstattung über Lemon Squeezy."
  />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://culoca.com/web/widerruf" />
  <link rel="icon" type="image/svg+xml" href="/culoca-icon.svg" />
  <link rel="icon" type="image/png" href="/culoca-icon.png" sizes="32x32" />
  <link rel="apple-touch-icon" href="/culoca-icon.png" sizes="180x180" />
  <meta property="og:title" content="Widerrufsbelehrung — Culoca Bildlizenzen" />
  <meta
    property="og:description"
    content="Widerrufsbelehrung für Culoca-Bildlizenzen: Widerrufsrecht, digitale Inhalte, Rückerstattung über Lemon Squeezy."
  />
  <meta property="og:url" content="https://culoca.com/web/widerruf" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DIRSCHL.com GmbH" />
  <meta property="og:locale" content="de_DE" />
</svelte:head>

<InfoPageLayout currentPage="widerruf">
  <h1>Widerrufsbelehrung</h1>

  <p class="lead">
    Diese Widerrufsbelehrung gilt für Verbraucher im Sinne des § 13 BGB, die über culoca.com
    <strong>kommerzielle Bildlizenzen</strong> erwerben. Zahlung und Rechnung erfolgen über
    <a href={ls.home} rel={externalLinkRel}>Lemon Squeezy</a> als Merchant of Record.
    Nutzungsrechte und Downloads werden von Culoca bereitgestellt.
  </p>

  <p>
    Ergänzend:
    <a href="/web/license">Lizenzinformationen</a> ·
    <a href="/web/impressum">Impressum</a> ·
    <a href="/web/datenschutz">Datenschutz</a>
  </p>

  <h2 id="widerrufsrecht">Widerrufsrecht</h2>
  <p>
    Sie haben das Recht, binnen <strong>vierzehn Tagen</strong> ohne Angabe von Gründen den Kaufvertrag
    über eine Bildlizenz zu widerrufen.
  </p>
  <p>
    Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses (Abschluss des
    Kaufprozesses im Lemon-Squeezy-Checkout).
  </p>
  <p>
    Um Ihr Widerrufsrecht auszuüben, müssen Sie uns oder Lemon Squeezy (je nach Art Ihres Anliegens,
    siehe unten) mittels einer eindeutigen Erklärung (z. B. per E-Mail oder per Post) über Ihren
    Entschluss, den Vertrag zu widerrufen, informieren.
  </p>

  <div class="highlight-box">
    <h3 class="box-heading">Vertragspartner beim Kauf</h3>
    <ul>
      <li>
        <strong>Kaufpreis &amp; Rechnung:</strong> Lemon Squeezy (Merchant of Record) —
        Rückerstattungen der Zahlung über
        <a href={ls.myOrders} rel={externalLinkRel}>Meine Bestellungen</a>,
        <a href={ls.culocaBilling} rel={externalLinkRel}>Culoca-Kundenbereich</a> oder
        <a href={ls.help} rel={externalLinkRel}>Lemon Squeezy Hilfe</a>.
        Rechtliche Grundlage:
        <a href={ls.buyerTerms} rel={externalLinkRel}>Lemon Squeezy Käufer-AGB</a>.
      </li>
      <li>
        <strong>Nutzungslizenz &amp; Download:</strong> DIRSCHL.com GmbH (Culoca) —
        bei Fragen zur Lizenz oder zum
        <a href="/web/license#tausch">Lizenz-Tausch</a>:
        <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a>.
      </li>
    </ul>
  </div>

  <h2 id="digital">Besonderheit: digitale Inhalte</h2>
  <p>
    Culoca-Bildlizenzen sind <strong>digitale Inhalte</strong>, die nicht auf einem körperlichen
    Datenträger geliefert werden. Der Download bzw. Zugriff auf die lizenzierte Datei kann
    unmittelbar nach Zahlungseingang möglich sein.
  </p>
  <p>
    <strong>Erlöschen des Widerrufsrechts:</strong> Ihr Widerrufsrecht erlischt vorzeitig, wenn wir
    mit der Ausführung des Vertrags (Bereitstellung des Downloads / Einräumung der Nutzungslizenz)
    begonnen haben, nachdem Sie
  </p>
  <ol>
    <li>ausdrücklich zugestimmt haben, dass wir mit der Ausführung vor Ablauf der Widerrufsfrist beginnen, und</li>
    <li>Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Ausführung
      Ihr Widerrufsrecht verlieren.</li>
  </ol>
  <p>
    Diese Zustimmung wird im <strong>Lemon-Squeezy-Checkout</strong> eingeholt
    (vgl. <a href={ls.buyerTerms} rel={externalLinkRel}>Käufer-AGB, „Digital Content“</a>).
    Haben Sie zugestimmt und bereits heruntergeladen, ist ein Widerruf regelmäßig ausgeschlossen;
    in Zweifelsfällen kontaktieren Sie uns oder Lemon Squeezy.
  </p>
  <p>
    Alternativ zum Widerruf: Bei versehentlich falschem Bild bieten wir einen
    <a href="/web/license#tausch">unkomplizierten Lizenz-Tausch</a> an (Kulanz, keine Rechtsverpflichtung).
  </p>

  <h2 id="folgen">Folgen des Widerrufs</h2>
  <p>
    Wenn Sie den Kauf wirksam widerrufen, haben Sie Anspruch auf Erstattung aller Zahlungen, die Sie
    für den betreffenden Kauf geleistet haben, einschließlich der Lieferkosten (entfällt bei rein
    digitalen Lizenzen). Die Erstattung erfolgt über Lemon Squeezy nach deren Richtlinie.
  </p>
  <p>
    Nach bestätigter Rückerstattung wird die zugehörige Bildlizenz in Ihrem Culoca-Konto
    <strong>deaktiviert</strong>; weitere Downloads sind nicht mehr gestattet.
  </p>

  <h2 id="muster">Muster-Widerrufsformular</h2>
  <p>
    Wenn Sie den Vertrag widerrufen wollen, können Sie folgendes Musterformular verwenden — Sie sind
    dazu jedoch nicht verpflichtet:
  </p>

  <div class="highlight-box form-box">
    <p class="form-title">Muster-Widerrufsformular</p>
    <p>
      (Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es zurück.)
    </p>
    <p>
      An<br />
      DIRSCHL.com GmbH, Waldberg 84, 84571 Reischach, Deutschland<br />
      E-Mail: johann.dirschl@gmx.de
    </p>
    <p>
      — und/oder bei Rückerstattung der Zahlung —<br />
      Lemon Squeezy (siehe Link in Ihrer Kaufbestätigung oder
      <a href={ls.help} rel={externalLinkRel}>lemonsqueezy.com/help</a>)
    </p>
    <p>
      Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf
      der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)
    </p>
    <p>— Bestellt am (*)/erhalten am (*)</p>
    <p>— Name des/der Verbraucher(s)</p>
    <p>— Anschrift des/der Verbraucher(s)</p>
    <p>— Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)</p>
    <p>— Datum</p>
    <p class="form-footnote">(*) Unzutreffendes streichen.</p>
  </div>

  <h2 id="kontakt">Kontakt &amp; Rückerstattung</h2>
  <div class="contact-info">
    <p><strong>Culoca / DIRSCHL.com GmbH</strong> (Lizenz, Tausch, technische Fragen)</p>
    <ul>
      <li>DIRSCHL.com GmbH, Waldberg 84, 84571 Reischach, Deutschland</li>
      <li>E-Mail: <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></li>
      <li>Telefon: <a href="tel:+491799766666">+49 179 9766666</a></li>
    </ul>
    <p><strong>Lemon Squeezy</strong> (Zahlung, Rechnung, Rückerstattung)</p>
    <ul>
      <li><a href={ls.myOrders} rel={externalLinkRel}>Meine Bestellungen</a></li>
      <li><a href={ls.culocaBilling} rel={externalLinkRel}>Culoca-Kundenbereich (Billing)</a></li>
      <li><a href={ls.help} rel={externalLinkRel}>Hilfe &amp; Kontakt</a></li>
      <li><a href={ls.buyerTerms} rel={externalLinkRel}>Käufer-AGB</a></li>
    </ul>
  </div>

  <div class="warning-box">
    <h4>Hinweis</h4>
    <p>
      Diese Widerrufsbelehrung ergänzt die
      <a href="/web/license">Lizenzinformationen</a> und die im Checkout bestätigten Bedingungen von
      Lemon Squeezy. Stand: {new Date().getFullYear()}. Keine Rechtsberatung.
    </p>
  </div>
</InfoPageLayout>

<style>
  .lead {
    font-size: 1.05rem;
    max-width: 68ch;
    color: var(--text-secondary);
  }

  .box-heading {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  .form-box {
    font-size: 0.95rem;
  }

  .form-title {
    font-weight: 600;
    margin: 0 0 0.75rem;
  }

  .form-footnote {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
</style>
