import { env } from '$env/dynamic/private';

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
 * AI Image Analyzer using Google Gemini API
 * Generates descriptions and keywords from images and titles
 */
export class AIImageAnalyzer {
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