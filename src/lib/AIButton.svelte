<script lang="ts">
  import { AIImageAnalyzer } from './aiImageAnalyzer';
  import { createEventDispatcher } from 'svelte';

  export let userTitle: string = '';
  export let imageFile: File | null = null;
  export let originalTitle: string = '';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    analysisComplete: { description: string; keywords: string };
    analysisError: { error: string };
  }>();

  let isAnalyzing = false;
  let showButton = false;

  // Show AI button when title has 40+ characters
  $: showButton = userTitle.length >= 40 && !disabled;

  async function handleAIAnalysis() {
    if (!imageFile || isAnalyzing) return;

    isAnalyzing = true;
    
    try {
      const analyzer = new AIImageAnalyzer();
      const imageBase64 = await analyzer.resizeImageForAI(imageFile);
      
      const result = await analyzer.analyzeImage({
        imageBase64,
        userTitle,
        originalTitle
      });

      if (result.success) {
        dispatch('analysisComplete', {
          description: result.description,
          keywords: result.keywords
        });
      } else {
        dispatch('analysisError', { error: result.error || 'AI analysis failed' });
      }
    } catch (error) {
      console.error('AI Analysis error:', error);
      dispatch('analysisError', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      isAnalyzing = false;
    }
  }
</script>

{#if showButton}
  <button
    type="button"
    class="ai-button"
    class:analyzing={isAnalyzing}
    on:click={handleAIAnalysis}
    disabled={isAnalyzing}
    title="KI-basierte Beschreibung und Keywords generieren"
  >
    {#if isAnalyzing}
      <span class="ai-icon">🤖</span>
      <span class="ai-text">KI analysiert...</span>
    {:else}
      <span class="ai-icon">🤖</span>
      <span class="ai-text">KI generieren</span>
    {/if}
  </button>
{/if}

<style>
  .ai-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }

  .ai-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .ai-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .ai-button.analyzing {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .ai-icon {
    font-size: 16px;
  }

  .ai-text {
    font-size: 13px;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* Dark mode support */
  :global(.dark) .ai-button {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
  }

  :global(.dark) .ai-button:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
  }
</style> 