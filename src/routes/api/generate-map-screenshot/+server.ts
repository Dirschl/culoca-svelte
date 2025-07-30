import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sharp from 'sharp';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { base64Image } = await request.json();
    
    if (!base64Image) {
      return json({ error: 'No image data provided' }, { status: 400 });
    }
    
    // Remove data URL prefix
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Process image with Sharp
    const processedImage = await sharp(buffer)
      .resize(1200, 630, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 75 })
      .toBuffer();
    
    // Convert back to base64
    const processedBase64 = `data:image/jpeg;base64,${processedImage.toString('base64')}`;
    
    return json({ 
      success: true, 
      screenshot: processedBase64 
    });
    
  } catch (error) {
    console.error('Error generating screenshot:', error);
    return json({ error: 'Failed to generate screenshot' }, { status: 500 });
  }
}; 