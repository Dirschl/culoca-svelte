import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

interface AIAnalysisRequest {
  imageBase64: string;
  userTitle: string;
  originalTitle?: string;
}

interface AIAnalysisResult {
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
    this.apiKey = env.GOOGLE_GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }
  }

  /**
   * Analyze image and generate description + keywords
   */
  async analyzeImage(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    try {
      const prompt = this.buildPrompt(request.userTitle, request.originalTitle);
      
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error('No response from Gemini API');
      }

      return this.parseAIResponse(generatedText);
    } catch (error) {
      console.error('AI Analysis failed:', error);
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
    const context = originalTitle ? `Original filename: ${originalTitle}` : '';
    
    return `Analyze this image and generate a detailed description and keywords for a photography website.

User-provided title: "${userTitle}"
${context}

Requirements:
1. Description: Write a detailed, engaging description (100-160 characters) that describes what's visible in the image, including location, mood, lighting, and composition. Focus on visual elements and atmosphere.

2. Keywords: Generate 10-15 relevant keywords separated by commas. Include:
   - Location/place names
   - Visual elements (colors, objects, architecture)
   - Mood/atmosphere
   - Photography style/technique
   - Geographic region if identifiable

Format your response exactly like this:
DESCRIPTION: [Your description here]
KEYWORDS: [keyword1, keyword2, keyword3, ...]

Keep the description concise but informative, and ensure keywords are relevant to the image content.`;
  }

  /**
   * Parse AI response into structured data
   */
  private parseAIResponse(response: string): AIAnalysisResult {
    try {
      const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=\n|KEYWORDS:|$)/i);
      const keywordsMatch = response.match(/KEYWORDS:\s*(.+?)(?=\n|$)/i);

      const description = descriptionMatch?.[1]?.trim() || '';
      const keywords = keywordsMatch?.[1]?.trim() || '';

      if (!description || !keywords) {
        throw new Error('Could not parse AI response');
      }

      return {
        description,
        keywords,
        success: true
      };
    } catch (error) {
      console.error('Failed to parse AI response:', response);
      return {
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
    const body = await request.json();
    const { imageBase64, userTitle, originalTitle } = body;

    if (!imageBase64 || !userTitle) {
      return json({ 
        success: false, 
        error: 'Missing required fields: imageBase64 and userTitle' 
      }, { status: 400 });
    }

    const analyzer = new AIImageAnalyzer();
    const result = await analyzer.analyzeImage({
      imageBase64,
      userTitle,
      originalTitle
    });

    return json(result);
  } catch (error) {
    console.error('AI Analysis API error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 