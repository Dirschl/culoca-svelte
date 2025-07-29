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
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`AI Analysis API error: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return result;
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