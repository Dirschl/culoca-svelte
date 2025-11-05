import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chromium } from 'playwright-core';
import chromiumPkg from '@sparticuz/chromium';

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

interface ScreenshotResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
  message?: string;
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
    const result = await generateScreenshot(options);

    if (!result.success) {
      return json({ 
        error: result.error || 'Failed to generate screenshot',
        message: result.message,
        url: targetUrl
      }, { status: 500 });
    }

    const screenshot = result.buffer;

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
    const result = await generateScreenshot(screenshotOptions);

    if (!result.success) {
      return json({ 
        error: result.error || 'Failed to generate screenshot',
        message: result.message,
        url: targetUrl
      }, { status: 500 });
    }

    const screenshot = result.buffer;

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
 * Get Chromium executable path (uses @sparticuz/chromium for Vercel Serverless)
 * Note: @sparticuz/chromium.executablePath() returns a Promise!
 */
async function getChromiumExecutablePath(): Promise<string> {
  // Check if we're in a serverless environment (Vercel, AWS Lambda, etc.)
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT;
  
  if (isServerless) {
    console.log('🌐 Serverless environment detected, using @sparticuz/chromium');
    try {
      // @sparticuz/chromium.executablePath() returns a Promise!
      const path = await chromiumPkg.executablePath();
      console.log('✅ @sparticuz/chromium executable path:', path);
      return path;
    } catch (error) {
      console.error('❌ Error getting @sparticuz/chromium path:', error);
      throw new Error('Failed to get Chromium executable path for serverless environment');
    }
  }
  
  // Use regular playwright for local development
  console.log('💻 Local environment detected, using playwright-core');
  return chromium.executablePath();
}

/**
 * Generate screenshot using Playwright
 */
async function generateScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
  let browser: any = null;
  
  try {
    // Check if we're in a serverless environment
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT;
    console.log('🌍 Environment check:', {
      VERCEL: !!process.env.VERCEL,
      AWS_LAMBDA: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
      LAMBDA_TASK_ROOT: !!process.env.LAMBDA_TASK_ROOT,
      isServerless
    });
    
    console.log('🚀 Launching Chromium browser...');
    
    // Get executable path (uses @sparticuz/chromium on Vercel)
    let executablePath: string;
    try {
      executablePath = await getChromiumExecutablePath();
      console.log('📍 Browser executable path resolved:', executablePath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to get executable path:', errorMsg);
      throw new Error(`Failed to get Chromium executable: ${errorMsg}`);
    }
    
    // Launch browser
    const launchOptions: any = {
      headless: true,
      executablePath,
      args: isServerless 
        ? chromiumPkg.args // Optimized args for serverless (@sparticuz/chromium)
        : [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
    };
    
    console.log('🔧 Launch options:', { 
      headless: launchOptions.headless, 
      executablePathLength: executablePath?.length || 0,
      argsCount: launchOptions.args?.length || 0,
      isServerless
    });
    
    browser = await chromium.launch(launchOptions);

    console.log('✅ Browser launched successfully');

    const context = await browser.newContext({
      viewport: {
        width: options.width || 1920,
        height: options.height || 1080
      }
    });

    const page = await context.newPage();

    // Set custom User-Agent for screenshot bot
    await page.setUserAgent('Mozilla/5.0 (compatible; ScreenshotBot/1.0; +https://example.com/bot)');

    console.log('🌐 Navigating to:', options.url);

    // Navigate to URL
    await page.goto(options.url, {
      waitUntil: options.waitUntil || 'networkidle',
      timeout: options.timeout || 30000
    });

    console.log('⏳ Waiting for dynamic content...');
    // Wait a bit for any dynamic content
    await page.waitForTimeout(1000);

    console.log('📸 Taking screenshot...');
    // Take screenshot
    const screenshotOptions: any = {
      type: options.format || 'jpeg',
      fullPage: options.fullPage || false
    };

    if (options.format === 'jpeg' && options.quality) {
      screenshotOptions.quality = options.quality;
    }

    const buffer = await page.screenshot(screenshotOptions);

    console.log('✅ Screenshot taken, size:', buffer.length, 'bytes');

    await browser.close();
    
    return {
      success: true,
      buffer
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : String(error);
    
    console.error('❌ Error generating screenshot:', errorMessage);
    console.error('❌ Error stack:', errorStack);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ Error closing browser:', closeError);
      }
    }
    
    return {
      success: false,
      error: 'Screenshot generation failed',
      message: errorMessage
    };
  }
}

