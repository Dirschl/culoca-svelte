<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="info-footer">
  <div class="footer-content">
    <div class="footer-section">
      <h4>DIRSCHL.com GmbH</h4>
      <p>Johann Dirschl</p>
      <p>Waldberg 84</p>
      <p>84571 Reischach</p>
    </div>
    
    <div class="footer-section">
      <h4>Kontakt</h4>
      <p><strong>Mobil:</strong> <a href="tel:+49-179-9766666">+49 179 9766666</a></p>
      <p><strong>Festnetz:</strong> <a href="tel:+49-8670-5590127">+49 8670 5590127</a></p>
      <p><strong>Büro:</strong> <a href="tel:+49-8670-8674004">+49 8670 8674004</a></p>
      <p><strong>Fax:</strong> <a href="tel:+49-8670-8674005">+49 8670 8674005</a></p>
      <p><strong>Email:</strong> <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></p>
    </div>
    
    <div class="footer-section">
      <h4>Informationen</h4>
      <ul>
        <li><a href="/system">System</a></li>
        <li><a href="/license">Lizenz</a></li>
        <li><a href="/impressum">Impressum</a></li>
        <li><a href="/datenschutz">Datenschutz</a></li>
      </ul>
    </div>
    
    <div class="footer-section">
      <h4>Recht</h4>
      <p><strong>Registergericht:</strong> Traunstein</p>
      <p><strong>HRB:</strong> 18130</p>
      <p><strong>Steuernummer:</strong> 141/124/50220</p>
      <p><strong>USt-IdNr.:</strong> DE258218256</p>
    </div>
  </div>
  
  <div class="footer-bottom">
    <p>&copy; {currentYear} DIRSCHL.com GmbH. Alle Rechte vorbehalten.</p>
  </div>
</footer>

<style>
  .info-footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    padding: 2rem 0 1rem 0;
    margin-top: 3rem;
    width: 100%;
  }

  .footer-content {
    width: 100%;
    margin: 0 auto;
    padding: 0 2rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
  }

  .footer-section h4 {
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .footer-section p {
    color: var(--text-secondary);
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }

  .footer-section ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .footer-section li {
    margin: 0.25rem 0;
  }

  .footer-section a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 0.2s ease;
  }

  .footer-section a:hover {
    color: var(--accent-color);
  }

  .footer-bottom {
    width: 100%;
    margin: 0 auto;
    padding: 1rem 2rem 0 2rem;
    border-top: 1px solid var(--border-color);
    margin-top: 2rem;
  }

  .footer-bottom p {
    color: var(--text-muted);
    text-align: center;
    margin: 0;
    font-size: 0.85rem;
  }

  @media (max-width: 768px) {
    .footer-content {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      padding: 0 1rem;
    }

    .footer-bottom {
      padding: 1rem 1rem 0 1rem;
    }
  }
</style> 