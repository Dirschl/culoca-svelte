import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chromium } from 'playwright';

interface ScreenshotOptions {
  url: string;
  width?: number;
  height?: number;
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  waitUntil?: 'load' | 'networkidle' | 'domcontentloaded';
  timeout?: number;
}

/**
 * Site Screenshot Service
 * 
 * Generates screenshots of websites for use in WordPress or other applications.
 * 
 * Usage:
 * GET /web/services/site-screenshot?url=https://example.com&width=1920&height=1080&format=jpeg
 * 
 * Parameters:
 * - url (required): The URL of the website to screenshot
 * - width (optional): Viewport width (default: 1920)
 * - height (optional): Viewport height (default: 1080)
 * - fullPage (optional): Capture full page (default: false)
 * - format (optional): Image format 'png' or 'jpeg' (default: 'jpeg')
 * - quality (optional): JPEG quality 1-100 (default: 80)
 * - waitUntil (optional): Wait strategy 'load' | 'networkidle' | 'domcontentloaded' (default: 'networkidle')
 * - timeout (optional): Timeout in milliseconds (default: 30000)
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return json({ 
        error: 'Missing required parameter: url',
        usage: 'GET /web/services/site-screenshot?url=https://example.com&width=1920&height=1080&format=jpeg'
      }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return json({ 
        error: 'Invalid URL format',
        provided: targetUrl
      }, { status: 400 });
    }

    // Parse options
    const options: ScreenshotOptions = {
      url: targetUrl,
      width: parseInt(url.searchParams.get('width') || '1920'),
      height: parseInt(url.searchParams.get('height') || '1080'),
      fullPage: url.searchParams.get('fullPage') === 'true',
      format: (url.searchParams.get('format') || 'jpeg') as 'png' | 'jpeg',
      quality: parseInt(url.searchParams.get('quality') || '80'),
      waitUntil: (url.searchParams.get('waitUntil') || 'networkidle') as 'load' | 'networkidle' | 'domcontentloaded',
      timeout: parseInt(url.searchParams.get('timeout') || '30000')
    };

    // Validate quality
    if (options.quality < 1 || options.quality > 100) {
      options.quality = 80;
    }

    // Validate dimensions
    if (options.width < 100 || options.width > 4096) {
      options.width = 1920;
    }
    if (options.height < 100 || options.height > 4096) {
      options.height = 1080;
    }

    console.log('📸 Generating screenshot:', options);

    // Generate screenshot
    const screenshot = await generateScreenshot(options);

    if (!screenshot) {
      return json({ 
        error: 'Failed to generate screenshot',
        url: targetUrl
      }, { status: 500 });
    }

    // Return image
    const contentType = options.format === 'png' ? 'image/png' : 'image/jpeg';
    
    return new Response(screenshot, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Screenshot-URL': targetUrl,
        'X-Screenshot-Dimensions': `${options.width}x${options.height}`,
        'X-Screenshot-FullPage': options.fullPage ? 'true' : 'false'
      }
    });

  } catch (error) {
    console.error('❌ Error in site-screenshot:', error);
    return json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

/**
 * POST handler for JSON-based requests (better for WordPress)
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { url: targetUrl, ...options } = body;

    if (!targetUrl) {
      return json({ 
        error: 'Missing required parameter: url',
        usage: 'POST /web/services/site-screenshot with JSON body: { "url": "https://example.com", "width": 1920, "height": 1080, "format": "jpeg" }'
      }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return json({ 
        error: 'Invalid URL format',
        provided: targetUrl
      }, { status: 400 });
    }

    // Parse options with defaults
    const screenshotOptions: ScreenshotOptions = {
      url: targetUrl,
      width: options.width || 1920,
      height: options.height || 1080,
      fullPage: options.fullPage || false,
      format: options.format || 'jpeg',
      quality: options.quality || 80,
      waitUntil: options.waitUntil || 'networkidle',
      timeout: options.timeout || 30000
    };

    // Validate quality
    if (screenshotOptions.quality < 1 || screenshotOptions.quality > 100) {
      screenshotOptions.quality = 80;
    }

    // Validate dimensions
    if (screenshotOptions.width < 100 || screenshotOptions.width > 4096) {
      screenshotOptions.width = 1920;
    }
    if (screenshotOptions.height < 100 || screenshotOptions.height > 4096) {
      screenshotOptions.height = 1080;
    }

    console.log('📸 Generating screenshot (POST):', screenshotOptions);

    // Generate screenshot
    const screenshot = await generateScreenshot(screenshotOptions);

    if (!screenshot) {
      return json({ 
        error: 'Failed to generate screenshot',
        url: targetUrl
      }, { status: 500 });
    }

    // Return JSON with base64 encoded image (better for WordPress)
    const base64 = screenshot.toString('base64');
    const contentType = screenshotOptions.format === 'png' ? 'image/png' : 'image/jpeg';
    
    return json({
      success: true,
      url: targetUrl,
      format: screenshotOptions.format,
      dimensions: {
        width: screenshotOptions.width,
        height: screenshotOptions.height,
        fullPage: screenshotOptions.fullPage
      },
      image: `data:${contentType};base64,${base64}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in site-screenshot (POST):', error);
    return json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

/**
 * Generate screenshot using Playwright
 */
async function generateScreenshot(options: ScreenshotOptions): Promise<Buffer | null> {
  let browser: any = null;
  
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext({
      viewport: {
        width: options.width || 1920,
        height: options.height || 1080
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Navigate to URL
    await page.goto(options.url, {
      waitUntil: options.waitUntil || 'networkidle',
      timeout: options.timeout || 30000
    });

    // Wait a bit for any dynamic content
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshotOptions: any = {
      type: options.format || 'jpeg',
      fullPage: options.fullPage || false
    };

    if (options.format === 'jpeg' && options.quality) {
      screenshotOptions.quality = options.quality;
    }

    const buffer = await page.screenshot(screenshotOptions);

    await browser.close();
    
    return buffer;

  } catch (error) {
    console.error('❌ Error generating screenshot:', error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return null;
  }
}

