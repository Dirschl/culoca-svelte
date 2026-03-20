import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

interface AIAnalysisRequest {
  imageBase64: string;
  userTitle: string;
  originalTitle?: string;
  countryName?: string;
  stateName?: string;
  regionName?: string;
  motifName?: string;
  districtName?: string;
  municipalityName?: string;
  localityName?: string;
  existingKeywords?: string;
  capturedAt?: string | null;
}

interface AIAnalysisResult {
  title: string;
  caption: string;
  description: string;
  keywords: string;
  success: boolean;
  error?: string;
}

/**
 * AI Image Analyzer using Google Gemini API
 * Server-side implementation for security
 */
class AIImageAnalyzer {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  constructor() {
    // Use SvelteKit's recommended environment variable loading
    this.apiKey = env.GOOGLE_GEMINI_API_KEY || '';
    
    console.log('🔍 AI Analyzer Debug:');
    console.log('  env.GOOGLE_GEMINI_API_KEY:', this.apiKey ? 'SET' : 'NOT SET');
    console.log('  Using Gemini Model: gemini-1.5-flash with v1beta API (fast and reliable)');
    
    if (!this.apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }
  }

  /**
   * Analyze image and generate description + keywords
   */
  async analyzeImage(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    try {
      console.log('🤖 Building prompt for Gemini API...');
      const prompt = this.buildPrompt(request);
      
      // Try multiple models in order of preference
      // gemini-2.5-flash-lite-preview-09-2025 works reliably
      const models = [
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent',
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent',
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-001:generateContent',
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent',
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent',
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
      ];
      
      let lastError: Error | null = null;
      
      for (const modelUrl of models) {
        try {
          console.log(`🤖 Trying Gemini API with model: ${modelUrl}`);
          console.log('🤖 Calling Gemini API:', {
            baseUrl: modelUrl,
            hasApiKey: !!this.apiKey,
            promptLength: prompt.length,
            imageBase64Length: request.imageBase64.length
          });
          
          const response = await fetch(`${modelUrl}?key=${this.apiKey}`, {
                    method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    text: prompt
                  },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: request.imageBase64
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              }
            })
          });

          console.log('🤖 Gemini API response status:', response.status);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            console.error('❌ Gemini API error:', errorData);
            lastError = new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
            continue; // Try next model
          }

          const data = await response.json();
          console.log('🤖 Gemini API data received:', {
            hasCandidates: !!data.candidates,
            candidatesLength: data.candidates?.length || 0
          });
          
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!generatedText) {
            console.error('❌ No text in Gemini response:', data);
            lastError = new Error('No response from Gemini API');
            continue; // Try next model
          }

          console.log('🤖 Generated text:', generatedText.substring(0, 200));
          
          const parsed = this.parseAIResponse(generatedText);
          console.log('🤖 Parsed result:', parsed);
          
          // Success! Return immediately
          return parsed;
        } catch (error) {
          console.error(`❌ Failed with model ${modelUrl}:`, error);
          lastError = error instanceof Error ? error : new Error('Unknown error');
          continue; // Try next model
        }
      }
      
      // All models failed
      console.error('❌ All Gemini models failed');
      return {
        title: '',
        caption: '',
        description: '',
        keywords: '',
        success: false,
        error: lastError?.message || 'All Gemini models failed'
      };
    } catch (error) {
      console.error('❌ AI Analysis failed:', error);
      return {
        title: '',
        caption: '',
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
  private buildPrompt(request: AIAnalysisRequest): string {
    const context = [
      request.originalTitle ? `Originaldateiname: ${request.originalTitle}` : '',
      request.countryName ? `Land: ${request.countryName}` : '',
      request.stateName ? `Bundesland/Kanton: ${request.stateName}` : '',
      request.regionName ? `Region/Bezirk: ${request.regionName}` : '',
      request.motifName ? `Motiv: ${request.motifName}` : '',
      request.localityName ? `Ortsteil/Stadtteil/Viertel: ${request.localityName}` : '',
      request.municipalityName ? `Gemeinde/Stadt: ${request.municipalityName}` : '',
      request.districtName ? `Landkreis/Bezirk: ${request.districtName}` : '',
      request.existingKeywords ? `Bereits bekannte Keywords: ${request.existingKeywords}` : '',
      request.capturedAt ? `Aufnahmedatum: ${request.capturedAt}` : ''
    ]
      .filter(Boolean)
      .join('\n');
    
    return `SPRACHE: Antworte ausschließlich auf Deutsch.

Analysiere dieses Bild und generiere Titel, Caption, Beschreibung und Schlüsselwörter für eine Fotografie-Website.

Nutzer-Titel oder Arbeitskontext: "${request.userTitle}"
${context}

Anforderungen:
1. Titel: 40-60 Zeichen, sachlich, suchmaschinenfreundlich, möglichst mit Ort oder Motiv. Kein Clickbait.
2. Caption: 60-180 Zeichen, optionaler Bilduntertitel in einem Satz, sachlich.
3. Beschreibung: 100-160 Zeichen, beschreibe sichtbare Elemente, Stimmung, Beleuchtung.
4. Schlüsselwörter: GENAU 30 Begriffe sind zwingend erforderlich. Getrennt durch Kommas. Nutze zuerst alle bereits bekannten Kontextdaten und ergänze sie mit sichtbaren Bildinhalten. Berücksichtige ALLE diese Kategorien:
   - Orte/Ortsnamen (Stadt, Landkreis, Region, Bundesland, Land)
   - Geografische Merkmale (Fluss, Berg, Tal, Wiese, Wald, etc.)
   - Visuelle Elemente (Farben, Objekte, Architektur, Natur)
   - Stimmung/Atmosphäre (abendlich, morgendlich, winterlich, sonnig, etc.)
   - Fotografie-Stil/Technik (Luftaufnahme, Makro, Landschaft, etc.)
   - Personen/Aktivitäten (wenn sichtbar)
   - Jahreszeit/Zeit (wenn erkennbar)
   - Wetter/Merkmal (Schnee, Regen, Sonne, Nebel, etc.)

WICHTIG: 
- Zähle die Keywords und stelle sicher, dass es exakt 30 sind
- Liefere keine Wortfragmente, Präfixe oder abgestuften Vorsilben wie "S, St, Ste, Stein"
- Liefere keine Teilwörter, Tippfragmente oder Buchstabenfolgen wie "Spor, Sportp, Steinhause"
- Ortsbegriffe dürfen nur verwendet werden, wenn sie vollständig ausgeschrieben sind
- Verwende bekannte Verwaltungsangaben bevorzugt: Land, Bundesland/Kanton, Region/Bezirk, Landkreis, Gemeinde/Stadt, optional Ortsteil
- Wenn bereits bekannte Keywords vorhanden sind, übernimm die guten Begriffe daraus und ergänze fehlende sinnvolle Begriffe
- Nutze sowohl spezifische als auch allgemeine Begriffe

Format:
TITLE: [Dein Titel hier]
CAPTION: [Deine Caption hier]
DESCRIPTION: [Deine Beschreibung hier]
KEYWORDS: [schlüsselwort1, schlüsselwort2, schlüsselwort3, ..., schlüsselwort30]

WICHTIG: Antworte nur auf Deutsch.`;
  }

  /**
   * Parse AI response into structured data
   */
  private parseAIResponse(response: string): AIAnalysisResult {
    try {
      const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=\n|KEYWORDS:|$)/i);
      const titleMatch = response.match(/TITLE:\s*(.+?)(?=\n|CAPTION:|DESCRIPTION:|KEYWORDS:|$)/i);
      const captionMatch = response.match(/CAPTION:\s*(.+?)(?=\n|DESCRIPTION:|KEYWORDS:|$)/i);
      const keywordsMatch = response.match(/KEYWORDS:\s*(.+?)(?=\n|$)/i);

      const title = titleMatch?.[1]?.trim() || '';
      const caption = captionMatch?.[1]?.trim() || '';
      const description = descriptionMatch?.[1]?.trim() || '';
      const keywords = keywordsMatch?.[1]?.trim() || '';

      if (!title || !description || !keywords) {
        throw new Error('Could not parse AI response');
      }

      return {
        title,
        caption,
        description,
        keywords,
        success: true
      };
    } catch (error) {
      console.error('Failed to parse AI response:', response);
      return {
        title: '',
        caption: '',
        description: '',
        keywords: '',
        success: false,
        error: 'Failed to parse AI response'
      };
    }
  }
}

export async function POST({ request }) {
  try {
    console.log('🤖 AI Analysis API called');
    
    const body = await request.json();
    const {
      imageBase64,
      userTitle,
      originalTitle,
      countryName,
      stateName,
      regionName,
      motifName,
      districtName,
      municipalityName,
      localityName,
      existingKeywords,
      capturedAt
    } = body;

    console.log('🤖 Request data:', {
      hasImageBase64: !!imageBase64,
      imageBase64Length: imageBase64?.length || 0,
      userTitle,
      originalTitle,
      countryName,
      stateName,
      regionName,
      motifName,
      districtName,
      municipalityName,
      localityName,
      existingKeywords,
      capturedAt
    });

    if (!imageBase64 || !userTitle) {
      console.error('❌ Missing required fields');
      return json({ 
        success: false, 
        error: 'Missing required fields: imageBase64 and userTitle' 
      }, { status: 400 });
    }

    console.log('🤖 Creating AI Analyzer...');
    const analyzer = new AIImageAnalyzer();
    
    console.log('🤖 Starting AI analysis...');
      const result = await analyzer.analyzeImage({
        imageBase64,
        userTitle,
        originalTitle,
        countryName,
        stateName,
        regionName,
        motifName,
        districtName,
        municipalityName,
        localityName,
        existingKeywords,
        capturedAt
      });

    console.log('🤖 AI Analysis result:', result);
    return json(result);
  } catch (error) {
    console.error('❌ AI Analysis API error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 
