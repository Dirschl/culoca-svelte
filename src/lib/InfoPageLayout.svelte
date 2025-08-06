<script lang="ts">
  import InfoPageHeader from './InfoPageHeader.svelte';
  import InfoPageFooter from './InfoPageFooter.svelte';
  
  export let currentPage: 'system' | 'license' | 'impressum' | 'datenschutz' | 'admin' = 'system';
  export let title: string = '';
  export let description: string = '';
</script>

<!-- SEO wird von den einzelnen Seiten definiert, nicht hier -->

<div class="info-page">
  <InfoPageHeader {currentPage} />
  
  <!-- Slot für randlose Inhalte (z.B. Banner) -->
  <slot name="fullwidth" />
  
  <main class="main-content">
    <div class="content-container">
      <slot />
    </div>
  </main>
  
  <InfoPageFooter />
</div>

<style>
  .info-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
  }

  .main-content {
    flex: 1;
    width: 100%;
    max-width: none;
    padding: 0;
  }

  .content-container {
    width: 100%;
    max-width: none;
    padding: 2rem;
    margin: 0;
    background: var(--bg-primary);
  }

  /* Einheitliche Typografie - nur für Info-Seiten */
  .info-page h1 {
    font-size: 2.5rem;
    margin: 2rem 0 0.5rem 0;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .info-page h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 1.5rem 0 0.7rem 0;
    padding: 0;
    line-height: 1.3;
    border-bottom: 2px solid var(--accent-color);
    padding-bottom: 0.5rem;
  }

  .info-page h3 {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 1.5rem 0 0.7rem 0;
    padding: 0;
    line-height: 1.4;
  }

  .info-page h4 {
    font-size: 1.2rem;
    margin: 1.5rem 0 0.5rem 0;
    color: var(--text-primary);
    line-height: 1.4;
  }

  p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 1rem 0;
  }

  ul, ol {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  li {
    margin: 0.5rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  a {
    color: var(--accent-color);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  a:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  /* Spezielle Styling-Klassen */
  .highlight-box {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1.5rem 0;
  }

  .warning-box {
    background: var(--bg-tertiary);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1.5rem 0;
  }

  .warning-box h4 {
    color: #f59e0b;
    margin-top: 0;
  }

  .contact-info {
    background: var(--bg-tertiary);
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1.5rem 0;
  }

  .contact-info h4 {
    margin-top: 0;
    color: var(--accent-color);
  }

  .contact-info ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .contact-info li {
    margin: 0.5rem 0;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .contact-info li:last-child {
    border-bottom: none;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .content-container {
      padding: 1rem;
    }

    h1 {
      font-size: 2rem;
    }

    h2 {
      font-size: 1.5rem;
    }

    h3 {
      font-size: 1.2rem;
    }
  }
</style> 