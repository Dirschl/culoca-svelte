import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chromium } from 'playwright';
import { execSync } from 'child_process';

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

// Cache for browser installation check
let browserInstallChecked = false;
let browserInstalled = false;

/**
 * Check and install Playwright browsers if needed (for Vercel Serverless)
 */
async function ensureBrowserInstalled(): Promise<boolean> {
  // Cache the result to avoid checking multiple times
  if (browserInstallChecked) {
    return browserInstalled;
  }
  
  browserInstallChecked = true;
  
  try {
    // Quick check: try to access browser executable path
    const chromiumPath = chromium.executablePath();
    console.log('✅ Browser executable found at:', chromiumPath);
    
    // Verify it actually exists
    const fs = await import('fs');
    if (fs.existsSync(chromiumPath)) {
      browserInstalled = true;
      return true;
    } else {
      throw new Error('Browser executable path returned but file does not exist');
    }
  } catch (error) {
    console.log('⚠️ Browser not found, attempting to install...');
    console.log('⚠️ Error:', error instanceof Error ? error.message : String(error));
    
    try {
      // For Vercel Serverless, install to /tmp (only writable directory)
      const installPath = process.env.VERCEL ? '/tmp/.cache/ms-playwright' : undefined;
      
      // Create directory structure if needed
      const fs = await import('fs');
      if (installPath) {
        try {
          fs.mkdirSync(installPath, { recursive: true });
          console.log('📁 Created directory:', installPath);
        } catch (mkdirError) {
          console.log('⚠️ Directory might already exist:', mkdirError);
        }
      }
      
      // Set npm/npx cache directories to /tmp for Vercel
      const env = {
        ...process.env,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0',
        PLAYWRIGHT_BROWSERS_PATH: installPath || process.env.PLAYWRIGHT_BROWSERS_PATH || '0',
        // Force npm/npx to use /tmp for cache
        NPM_CONFIG_CACHE: process.env.VERCEL ? '/tmp/.npm' : process.env.NPM_CONFIG_CACHE,
        HOME: process.env.VERCEL ? '/tmp' : process.env.HOME,
        XDG_CACHE_HOME: process.env.VERCEL ? '/tmp/.cache' : process.env.XDG_CACHE_HOME
      };
      
      // Create npm cache directory
      if (process.env.VERCEL && env.NPM_CONFIG_CACHE) {
        try {
          fs.mkdirSync(env.NPM_CONFIG_CACHE, { recursive: true });
        } catch (e) {
          // Ignore
        }
      }
      
      console.log('📦 Installing browsers to:', env.PLAYWRIGHT_BROWSERS_PATH || 'default location');
      console.log('📦 Using npm cache:', env.NPM_CONFIG_CACHE || 'default');
      
      // Install browsers in runtime (for Vercel Serverless)
      // Install both chromium and chromium-headless-shell (needed for single-process mode)
      // Keep cwd as project directory so npx can find node_modules
      const cwd = process.env.VERCEL ? '/var/task' : process.cwd();
      
      console.log('📦 Installing chromium...');
      execSync('npx playwright install chromium --with-deps', {
        stdio: 'inherit',
        timeout: 180000, // 3 minutes timeout
        env,
        cwd
      });
      
      console.log('📦 Installing chromium-headless-shell...');
      execSync('npx playwright install chromium-headless-shell --with-deps', {
        stdio: 'inherit',
        timeout: 180000, // 3 minutes timeout
        env,
        cwd
      });
      
      console.log('✅ Browser installed successfully');
      
      // Verify installation
      try {
        const chromiumPath = chromium.executablePath();
        console.log('✅ Verified browser at:', chromiumPath);
        browserInstalled = true;
        return true;
      } catch (verifyError) {
        console.error('❌ Browser installation verification failed:', verifyError);
        browserInstalled = false;
        return false;
      }
    } catch (installError) {
      console.error('❌ Failed to install browser:', installError);
      browserInstalled = false;
      return false;
    }
  }
}

/**
 * Generate screenshot using Playwright
 */
async function generateScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
  let browser: any = null;
  
  try {
    // Ensure browser is installed (especially for Vercel Serverless)
    const browserInstalled = await ensureBrowserInstalled();
    if (!browserInstalled) {
      return {
        success: false,
        error: 'Browser installation failed',
        message: 'Could not install Chromium browser. Please check Vercel build logs.'
      };
    }
    
    console.log('🚀 Launching Chromium browser...');
    
    // Launch browser
    // For Vercel, use the installed browser path
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
        // Removed --single-process to avoid chromium-headless-shell requirement
        // Use regular chromium instead
      ]
    };
    
    // If we installed to /tmp, specify the executable path
    if (process.env.VERCEL && process.env.PLAYWRIGHT_BROWSERS_PATH) {
      try {
        const chromiumPath = chromium.executablePath();
        if (chromiumPath) {
          launchOptions.executablePath = chromiumPath;
          console.log('📍 Using browser executable:', chromiumPath);
        }
      } catch (e) {
        console.log('⚠️ Could not get executable path, using default');
      }
    }
    
    browser = await chromium.launch(launchOptions);

    console.log('✅ Browser launched successfully');

    const context = await browser.newContext({
      viewport: {
        width: options.width || 1920,
        height: options.height || 1080
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

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

