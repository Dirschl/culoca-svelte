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
      waitUntil: (url.searchParams.get('waitUntil') || 'domcontentloaded') as 'load' | 'networkidle' | 'domcontentloaded',
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

    // Generate screenshot with retry logic (2 attempts max for faster failure)
    const result = await generateScreenshotWithRetry(options, 2);

    if (!result.success) {
      console.error('❌ Screenshot generation failed after retries:', result.error);
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
      waitUntil: options.waitUntil || 'domcontentloaded',
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

    // Generate screenshot with retry logic
    const result = await generateScreenshotWithRetry(screenshotOptions, 3);

    if (!result.success) {
      console.error('❌ Screenshot generation failed after retries:', result.error);
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
 * Generate screenshot with retry logic
 * Retries up to maxRetries times if screenshot generation fails
 */
async function generateScreenshotWithRetry(
  options: ScreenshotOptions,
  maxRetries: number = 2
): Promise<ScreenshotResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 Screenshot attempt ${attempt}/${maxRetries} for ${options.url}`);
    
    try {
      // Use shorter timeout for retries (faster failure)
      const retryOptions = {
        ...options,
        timeout: attempt > 1 ? Math.min(options.timeout || 30000, 20000) : options.timeout || 30000
      };
      const result = await generateScreenshot(retryOptions);
      
      if (result.success) {
        if (attempt > 1) {
          console.log(`✅ Screenshot succeeded on attempt ${attempt}`);
        }
        return result;
      }
      
      // If result has an error, log it but continue to retry
      lastError = result.error ? new Error(result.error) : new Error('Screenshot generation failed');
      console.log(`⚠️ Attempt ${attempt} failed: ${lastError.message}`, {
        url: options.url,
        error: result.error,
        message: result.message
      });
      
      // Wait before retrying (shorter wait for faster processing)
      if (attempt < maxRetries) {
        const waitTime = Math.min(500 * attempt, 2000); // Max 2 seconds (500ms, 1000ms)
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`❌ Attempt ${attempt} threw error:`, {
        url: options.url,
        error: lastError.message,
        stack: lastError.stack
      });
      
      // Wait before retrying (shorter wait for faster processing)
      if (attempt < maxRetries) {
        const waitTime = Math.min(500 * attempt, 2000); // Max 2 seconds (500ms, 1000ms)
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  console.error(`❌ All ${maxRetries} attempts failed for ${options.url}`, {
    url: options.url,
    attempts: maxRetries,
    lastError: lastError?.message,
    stack: lastError?.stack
  });
  return {
    success: false,
    error: 'Screenshot generation failed after all retries',
    message: lastError?.message || 'Unknown error'
  };
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
    
    // Launch browser with memory-optimized settings for serverless
    const launchOptions: any = {
      headless: true,
      executablePath,
      args: isServerless 
        ? [
            ...chromiumPkg.args,
            // Reduce shared memory usage to handle low /tmp space
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ]
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
    
    // Wait a bit for browser to fully initialize (especially in serverless environments)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if browser is still connected before creating context
    if (!browser.isConnected()) {
      throw new Error('Browser disconnected immediately after launch (likely due to insufficient resources or /tmp space)');
    }

    let context: any;
    try {
      context = await browser.newContext({
        viewport: {
          width: options.width || 1920,
          height: options.height || 1080
        },
        // Set custom User-Agent for screenshot bot
        userAgent: 'Mozilla/5.0 (compatible; ScreenshotBot/1.0; +https://culoca.com/bot)'
      });
      console.log('✅ Browser context created');
    } catch (contextError) {
      const errorMsg = contextError instanceof Error ? contextError.message : String(contextError);
      throw new Error(`Failed to create browser context: ${errorMsg}. Browser may have closed due to insufficient /tmp space.`);
    }

    let page: any;
    try {
      // Check browser connection again before creating page
      if (!browser.isConnected()) {
        throw new Error('Browser disconnected before creating page');
      }
      page = await context.newPage();
      console.log('✅ Browser page created');
    } catch (pageError) {
      const errorMsg = pageError instanceof Error ? pageError.message : String(pageError);
      throw new Error(`Failed to create browser page: ${errorMsg}. Browser may have closed due to insufficient resources.`);
    }

    console.log('🌐 Navigating to:', options.url);

    // Navigate to URL with fallback strategy
    // First try with domcontentloaded (faster, more reliable)
    // If that fails, try load, then commit
    let navigationSuccess = false;
    
    // Strategy 1: Try domcontentloaded (fast and reliable)
    try {
      await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000
      });
      console.log('✅ Page loaded (domcontentloaded)');
      navigationSuccess = true;
      
      // If networkidle was requested, wait a bit longer for network activity to settle
      // But don't block forever - use a reasonable timeout
      if (options.waitUntil === 'networkidle') {
        console.log('⏳ Waiting for network to settle...');
        // Wait for network requests to settle (simulated networkidle)
        // Most pages settle within 5-10 seconds
        await page.waitForTimeout(5000);
        console.log('✅ Network activity settled');
      }
    } catch (error) {
      console.log('⚠️ domcontentloaded failed, trying load event...');
      
      // Strategy 2: Try load event
      try {
        await page.goto(options.url, {
          waitUntil: 'load',
          timeout: options.timeout || 30000
        });
        console.log('✅ Page loaded (load event)');
        navigationSuccess = true;
      } catch (loadError) {
        console.log('⚠️ load event failed, trying commit...');
        
        // Strategy 3: Try commit (just wait for navigation to start)
        try {
          await page.goto(options.url, {
            waitUntil: 'commit',
            timeout: options.timeout || 30000
          });
          console.log('✅ Page navigation committed');
          // Wait a bit for content to load
          await page.waitForTimeout(3000);
          navigationSuccess = true;
        } catch (commitError) {
          console.error('❌ All navigation strategies failed');
          throw new Error(`Failed to navigate to ${options.url}: ${commitError instanceof Error ? commitError.message : 'Unknown error'}`);
        }
      }
    }
    
    if (!navigationSuccess) {
      throw new Error(`Failed to navigate to ${options.url}`);
    }

    console.log('⏳ Waiting for dynamic content...');
    // Wait longer for cookie banners and dynamic content to load
    await page.waitForTimeout(2000);

    console.log('🍪 Removing cookie consent banners...');
    
    // Remove cookie banners multiple times (some load with delay)
    const removeCookieBanners = async () => {
      await page.evaluate(() => {
      // Common cookie consent banner selectors
      const cookieSelectors = [
        // Generic cookie consent classes/ids
        '[id*="cookie"]',
        '[class*="cookie"]',
        '[id*="Cookie"]',
        '[class*="Cookie"]',
        '[id*="COOKIE"]',
        '[class*="COOKIE"]',
        // Common consent banner libraries
        '#CybotCookiebotDialog',
        '#cookie-law-info-bar',
        '.cookie-law-info-bar',
        '#cookieNotice',
        '.cookie-notice',
        '#cookie-bar',
        '.cookie-bar',
        '#cookieconsent',
        '.cookieconsent',
        '#cookieConsent',
        '.cookieConsent',
        '#gdpr-cookie-consent',
        '.gdpr-cookie-consent',
        '#cc-window',
        '.cc-window',
        '#cc-banner',
        '.cc-banner',
        '#consent-banner',
        '.consent-banner',
        '#privacy-policy-banner',
        '.privacy-policy-banner',
        // CookieBot, OneTrust, etc.
        '[id*="onetrust"]',
        '[class*="onetrust"]',
        '[id*="Cookiebot"]',
        '[class*="Cookiebot"]',
        // GDPR specific
        '[id*="gdpr"]',
        '[class*="gdpr"]',
        '[id*="GDPR"]',
        '[class*="GDPR"]',
        // Common overlay patterns
        '[data-cookie*="consent"]',
        '[data-gdpr*="consent"]',
        '[role="dialog"][aria-label*="cookie" i]',
        '[role="dialog"][aria-label*="Cookie" i]',
        '[role="dialog"][aria-label*="consent" i]',
        '[role="dialog"][aria-label*="Consent" i]',
        // Common bottom banners
        '.cookie-banner-bottom',
        '#cookie-banner-bottom',
        '.cookie-popup',
        '#cookie-popup',
        // Additional common patterns
        '[id*="cookie-banner"]',
        '[class*="cookie-banner"]',
        '[id*="cookie-popup"]',
        '[class*="cookie-popup"]',
        '[id*="cookie-notice"]',
        '[class*="cookie-notice"]',
        '[id*="cookie-consent"]',
        '[class*="cookie-consent"]',
        '[id*="cookiebar"]',
        '[class*="cookiebar"]',
        '[id*="cookieBar"]',
        '[class*="cookieBar"]',
        // WordPress specific
        '#cookie-law-info-bar',
        '.cookie-law-info-bar',
        '#cliModalBackDrop',
        '.cli-modal-backdrop',
        // Iframe cookie banners
        'iframe[src*="cookie"]',
        'iframe[id*="cookie"]',
        'iframe[class*="cookie"]'
      ];

      cookieSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el: Element) => {
            const element = el as HTMLElement;
            // Check if element contains cookie-related text
            const text = element.textContent?.toLowerCase() || '';
            if (
              text.includes('cookie') ||
              text.includes('consent') ||
              text.includes('gdpr') ||
              text.includes('privacy') ||
              text.includes('datenschutz') ||
              text.includes('accept') ||
              text.includes('akzeptieren') ||
              element.id.toLowerCase().includes('cookie') ||
              element.className.toLowerCase().includes('cookie')
            ) {
              // Remove element
              element.style.display = 'none';
              element.remove();
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Also try to click common "Accept" buttons to dismiss banners
      const acceptButtonSelectors = [
        'button[class*="accept"]',
        'button[id*="accept"]',
        'button[class*="Accept"]',
        'button[id*="Accept"]',
        'a[class*="accept"]',
        'a[id*="accept"]',
        '[class*="cookie"] button',
        '[id*="cookie"] button',
        '[class*="consent"] button',
        '[id*="consent"] button',
        // More specific selectors
        'button[class*="cookie"]',
        'button[id*="cookie"]',
        'a[class*="cookie"]',
        'a[id*="cookie"]',
        '[class*="cookie"] [class*="accept"]',
        '[id*="cookie"] [class*="accept"]',
        '[class*="cookie"] [id*="accept"]',
        '[id*="cookie"] [id*="accept"]'
      ];

      acceptButtonSelectors.forEach(selector => {
        try {
          const buttons = document.querySelectorAll(selector);
          buttons.forEach((btn: Element) => {
            const button = btn as HTMLElement;
            const text = button.textContent?.toLowerCase() || '';
            if (
              text.includes('accept') ||
              text.includes('akzeptieren') ||
              text.includes('ok') ||
              text.includes('agree') ||
              text.includes('zustimmen') ||
              text.includes('allow') ||
              text.includes('erlauben') ||
              text.includes('alle akzeptieren') ||
              text.includes('all accept')
            ) {
              try {
                // Scroll button into view if needed
                button.scrollIntoView({ behavior: 'instant', block: 'center' });
                button.click();
                // Also try to trigger click event
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                button.dispatchEvent(clickEvent);
              } catch (e) {
                // Ignore click errors
              }
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Remove any remaining overlay elements that might be cookie banners
      const allElements = document.querySelectorAll('*');
      const viewportHeight = window.innerHeight;
      
      allElements.forEach((el: Element) => {
        const element = el as HTMLElement;
        const style = window.getComputedStyle(element);
        const zIndex = parseInt(style.zIndex || '0', 10);
        const rect = element.getBoundingClientRect();
        const bottom = rect.bottom;
        const isAtBottom = bottom > viewportHeight * 0.8; // Bottom 20% of screen
        const isOverlay = style.position === 'fixed' || style.position === 'absolute';
        const text = element.textContent?.toLowerCase() || '';
        const id = element.id.toLowerCase();
        const className = element.className.toLowerCase();
        
        // Check if element is an overlay (high z-index, positioned fixed/absolute)
        // OR if it's at the bottom of the screen (common for cookie banners)
        const isCookieBanner = (
          text.includes('cookie') ||
          text.includes('consent') ||
          text.includes('gdpr') ||
          text.includes('privacy') ||
          text.includes('datenschutz') ||
          text.includes('accept') ||
          text.includes('akzeptieren') ||
          text.includes('zustimmen') ||
          id.includes('cookie') ||
          id.includes('consent') ||
          id.includes('gdpr') ||
          className.includes('cookie') ||
          className.includes('consent') ||
          className.includes('gdpr')
        );
        
        // Remove if:
        // 1. It's a cookie banner (by text/ID/class)
        // 2. OR it's a high z-index overlay at the bottom of the screen (likely a banner)
        if (
          isOverlay && (
            (zIndex > 1000 && isCookieBanner) ||
            (isAtBottom && zIndex > 500) || // High z-index at bottom = likely banner
            (isAtBottom && rect.height < 150 && rect.width > viewportHeight * 0.5) // Wide, short element at bottom
          )
        ) {
          // Use !important to override any inline styles
          element.style.setProperty('display', 'none', 'important');
          element.style.setProperty('visibility', 'hidden', 'important');
          element.style.setProperty('opacity', '0', 'important');
          element.style.setProperty('height', '0', 'important');
          element.style.setProperty('max-height', '0', 'important');
          element.style.setProperty('overflow', 'hidden', 'important');
          try {
            element.remove();
          } catch (e) {
            // Ignore removal errors
          }
        }
      });
      
      // Remove body/html classes that might control cookie banner visibility
      const body = document.body;
      const html = document.documentElement;
      
      if (body) {
        Array.from(body.classList).forEach(cls => {
          if (cls.toLowerCase().includes('cookie') || 
              cls.toLowerCase().includes('consent') || 
              cls.toLowerCase().includes('gdpr')) {
            body.classList.remove(cls);
          }
        });
      }
      
      if (html) {
        Array.from(html.classList).forEach(cls => {
          if (cls.toLowerCase().includes('cookie') || 
              cls.toLowerCase().includes('consent') || 
              cls.toLowerCase().includes('gdpr')) {
            html.classList.remove(cls);
          }
        });
      }
      
      // Add CSS to hide any remaining cookie-related elements
      const style = document.createElement('style');
      style.id = 'culoca-cookie-hider';
      style.textContent = `
        [id*="cookie" i],
        [class*="cookie" i],
        [id*="consent" i],
        [class*="consent" i],
        [id*="gdpr" i],
        [class*="gdpr" i],
        [role="dialog"][aria-label*="cookie" i],
        [role="dialog"][aria-label*="consent" i] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      });
    };

    // Remove cookie banners multiple times (some load with delay)
    await removeCookieBanners();
    await page.waitForTimeout(1000); // Wait for banner animations/closing
    await removeCookieBanners();
    await page.waitForTimeout(1000); // Wait for banner animations/closing
    await removeCookieBanners();
    await page.waitForTimeout(1000); // Final wait before screenshot

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

