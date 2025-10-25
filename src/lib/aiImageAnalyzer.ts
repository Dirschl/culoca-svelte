interface AIAnalysisResult {
  description: string;
  keywords: string;
  success: boolean;
  error?: string;
}

interface AIAnalysisRequest {
  imageBase64: string;
  userTitle: string;
  originalTitle?: string;
}

/**
 * AI Image Analyzer using Server API
 * Client-side implementation that calls server API
 */
export class AIImageAnalyzer {
  /**
   * Analyze image and generate description + keywords
   */
  async analyzeImage(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    try {
      console.log('🤖 Client: Sending AI analysis request...');
      console.log('🤖 Client: Request data:', {
        userTitle: request.userTitle,
        originalTitle: request.originalTitle,
        imageBase64Length: request.imageBase64?.length || 0
      });
      
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      console.log('🤖 Client: Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Client: API error:', errorData);
        throw new Error(`AI Analysis API error: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('🤖 Client: Result received:', result);
      return result;
    } catch (error) {
      console.error('❌ Client: AI Analysis failed:', error);
      return {
        description: '',
        keywords: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

/**
 * Build optimized prompt for image analysis
 */
private buildPrompt(userTitle: string, originalTitle?: string): string {
  const context = originalTitle ? `Originaldateiname: ${originalTitle}` : '';

  return `**Priorität Sprache und Länge**: Die gesamte Antwort muss in der Sprache des bereitgestellten "Vom Nutzer bereitgestellter Titel" erfolgen. Falls die Sprache des Titels nicht eindeutig erkennbar ist (insbesondere bei kurzen Titeln oder vielen Eigennamen wie Orten), **verwende Deutsch als Standardsprache für die Ausgabe.** Die Beschreibung **MUSS UNBEDINGT** zwischen 100 und **maximal 160 Zeichen** lang sein. Kein einziges Zeichen mehr!

Analysiere dieses Bild basierend auf den bereitgestellten Informationen und generiere eine detaillierte, **sachliche und beschreibende** Beschreibung und relevante Schlüsselwörter.

Vom Nutzer bereitgestellter Titel (oft sehr kurz und ortsbezogen, z.B. "Burg in Burghausen", "Winter in Maria Ach"): "${userTitle}"
${context}

Anforderungen:
1.  **Beschreibung (Description)**: Erstelle eine ansprechende, prägnante und **EXAKT zwischen 100 und 160 Zeichen lange** Beschreibung des Bildes. KEINE AUSNAHMEN BEI DER LÄNGE! Die Beschreibung muss die sichtbaren Elemente, Stimmung, Beleuchtung und Komposition umfassen. **Vermeide dabei allgemeine, blumige oder subjektive Adjektive wie "schön", "wunderschön", "idyllisch", "atemberaubend", "sonnenverwöhnt". Konzentriere dich stattdessen auf spezifische, visuelle Details, Lichtverhältnisse, Komposition und objektiv wahrnehmbare Eigenschaften.** Fokus liegt auf visuellen und atmosphärischen Aspekten. **Die maximale Länge von 160 Zeichen darf auf keinen Fall überschritten werden.**
2.  **Schlüsselwörter (Keywords)**: Generiere 40-50 relevante Schlüsselwörter, die durch Kommas getrennt sind. Berücksichtige dabei:
    * **Orte/Ortsnamen (Nutze den bereitgestellten Titel aktiv für Orts- und Sprachfindung!)**
    * Visuelle Elemente (Farben, Objekte, Architektur, z.B. "Rot", "Backstein", "Wolkenkratzer")
    * Fotografie-Stil/Technik (z.B. "Weitwinkel", "Schwarz-Weiß", "Langzeitbelichtung")
    Vermeide Beschreibung der Stimmung/Atmosphäre (z.B. "Dämmrig", "Lebhaft", "Ruhig" – aber nicht "traumhaft")
    Vermeide Geografische Region (falls erkennbar)

Format der Antwort (genau so):
DESCRIPTION: [Deine Beschreibung hier]
KEYWORDS: [schlüsselwort1, schlüsselwort2, schlüsselwort3, ...]

Halte die Beschreibung prägnant, aber informativ. Stelle sicher, dass die Schlüsselwörter direkt auf den Bildinhalt bezogen sind und die Beschreibung **UNTER 160 ZEICHEN BLEIBT**. Denke daran, die Antwort immer in der erkannten Sprache oder als Fallback auf Deutsch zu verfassen.`;
}
  /**
   * Resize image to base64 for API transmission
   */
  async resizeImageForAI(imageFile: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Resize to max 800px width/height for API efficiency
        const maxSize = 800;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 JPEG
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        
        resolve(base64Data);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageFile);
    });
  }
} 