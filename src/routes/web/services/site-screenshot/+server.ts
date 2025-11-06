import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chromium } from 'playwright-core';
import chromiumPkg from '@sparticuz/chromium';

// Rate limiting: Maximum concurrent screenshot generations per serverless instance
// Reduced to 1 to prevent /tmp space issues in Vercel serverless environment
// NO QUEUE: If a screenshot is already running, immediately reject new requests with HTTP 503
// This forces clients (like WordPress plugins) to send requests sequentially
const MAX_CONCURRENT_SCREENSHOTS = 1;
let activeScreenshotCount = 0;

/**
 * Acquire a screenshot slot
 * Returns true if slot acquired, false if already in use (no queue - immediate rejection)
 */
function acquireScreenshotSlot(): boolean {
  if (activeScreenshotCount < MAX_CONCURRENT_SCREENSHOTS) {
    activeScreenshotCount++;
    console.log(`✅ Screenshot slot acquired (${activeScreenshotCount} active)`);
    return true;
  } else {
    console.log(`⚠️ Screenshot slot busy (${activeScreenshotCount} active) - rejecting request immediately (no queue)`);
    return false;
  }
}

/**
 * Release a screenshot slot
 */
function releaseScreenshotSlot(): void {
  if (activeScreenshotCount > 0) {
    activeScreenshotCount--;
    console.log(`🔓 Screenshot slot released (${activeScreenshotCount} active)`);
  } else {
    console.warn(`⚠️ Attempted to release slot but activeScreenshotCount is already 0`);
  }
}

interface ScreenshotOptions {
  url: string;
  width?: number;
  height?: number;
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  waitUntil?: 'load' | 'networkidle' | 'domcontentloaded';
  timeout?: number;
  useBotUserAgent?: boolean; // Use bot User-Agent when bot=1 parameter is present (for Real Cookie Manager)
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
  const targetUrl = url.searchParams.get('url');
  console.log(`📥 GET request received for: ${targetUrl || 'NO URL'} (active: ${activeScreenshotCount})`);
  
  // Acquire screenshot slot (immediate rejection if busy - no queue)
  const slotAcquired = acquireScreenshotSlot();
  
  if (!slotAcquired) {
    console.log(`❌ Slot acquisition failed for: ${targetUrl || 'NO URL'} (active: ${activeScreenshotCount}) - service busy, please retry`);
    return json({ 
      error: 'Service temporarily unavailable',
      message: 'Screenshot service is busy. Please retry in a moment.',
      retryAfter: 5
    }, { 
      status: 503,
      headers: {
        'Retry-After': '5'
      }
    });
  }
  
  console.log(`✅ Slot acquired for: ${targetUrl || 'NO URL'} (active: ${activeScreenshotCount})`);
  
  try {
    if (!targetUrl) {
      releaseScreenshotSlot();
      return json({ 
        error: 'Missing required parameter: url',
        usage: 'GET /web/services/site-screenshot?url=https://example.com&width=1920&height=1080&format=jpeg'
      }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      releaseScreenshotSlot();
      return json({ 
        error: 'Invalid URL format',
        provided: targetUrl
      }, { status: 400 });
    }

    // Check if bot=1 parameter is present in the target URL
    // WordPress adds ?bot=1&nocookie=1&rcm_skip=1 to bypass cookie managers
    // When bot=1 is present, we must use a bot User-Agent for Real Cookie Manager to work
    const botParam = parsedUrl.searchParams.get('bot');
    console.log(`🔍 [GET] Bot parameter from URL: "${botParam}" (type: ${typeof botParam})`);
    const useBotUserAgent = botParam === '1';
    console.log(`🔍 [GET] useBotUserAgent calculated: ${useBotUserAgent}`);
    
    if (useBotUserAgent) {
      console.log('🤖 Bot mode enabled: bot=1 parameter detected, will use bot User-Agent');
    } else {
      console.log('👤 Normal mode: no bot parameter or bot!=1, will use normal User-Agent');
    }

    // Parse options
    const options: ScreenshotOptions = {
      url: targetUrl,
      width: parseInt(url.searchParams.get('width') || '1920'),
      height: parseInt(url.searchParams.get('height') || '1080'),
      fullPage: url.searchParams.get('fullPage') === 'true',
      format: (url.searchParams.get('format') || 'jpeg') as 'png' | 'jpeg',
      quality: parseInt(url.searchParams.get('quality') || '80'),
      waitUntil: (url.searchParams.get('waitUntil') || 'load') as 'load' | 'networkidle' | 'domcontentloaded', // Default to 'load' for fully rendered pages
      timeout: parseInt(url.searchParams.get('timeout') || '15000'), // Reduced from 30s to 15s for faster processing
      useBotUserAgent: useBotUserAgent === true // Explicitly ensure it's boolean true, not just truthy
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
      releaseScreenshotSlot();
      return json({ 
        error: result.error || 'Failed to generate screenshot',
        message: result.message,
        url: targetUrl
      }, { status: 500 });
    }

    const screenshot = result.buffer;

    // Return image
    const contentType = options.format === 'png' ? 'image/png' : 'image/jpeg';
    
    releaseScreenshotSlot();
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
    releaseScreenshotSlot();
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
  // Parse body first to get URL for logging
  const body = await request.json().catch(() => ({}));
  const { url: targetUrl } = body;
  
  console.log(`📥 POST request received for: ${targetUrl || 'NO URL'} (active: ${activeScreenshotCount})`);
  
  // Acquire screenshot slot (immediate rejection if busy - no queue)
  const slotAcquired = acquireScreenshotSlot();
  
  if (!slotAcquired) {
    console.log(`❌ Slot acquisition failed for: ${targetUrl || 'NO URL'} (active: ${activeScreenshotCount}) - service busy, please retry`);
    return json({ 
      error: 'Service temporarily unavailable',
      message: 'Screenshot service is busy. Please retry in a moment.',
      retryAfter: 5
    }, { 
      status: 503,
      headers: {
        'Retry-After': '5'
      }
    });
  }
  
  console.log(`✅ Slot acquired for: ${targetUrl || 'NO URL'} (active: ${activeScreenshotCount})`);
  
  try {
    const { url: urlParam, ...options } = body;
    const targetUrlParam = urlParam || targetUrl;

    if (!targetUrlParam) {
      releaseScreenshotSlot();
      return json({ 
        error: 'Missing required parameter: url',
        usage: 'POST /web/services/site-screenshot with JSON body: { "url": "https://example.com", "width": 1920, "height": 1080, "format": "jpeg" }'
      }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrlParam);
    } catch {
      releaseScreenshotSlot();
      return json({ 
        error: 'Invalid URL format',
        provided: targetUrlParam
      }, { status: 400 });
    }

    // Check if bot=1 parameter is present in the target URL
    // WordPress adds ?bot=1&nocookie=1&rcm_skip=1 to bypass cookie managers
    // When bot=1 is present, we must use a bot User-Agent for Real Cookie Manager to work
    const botParam = parsedUrl.searchParams.get('bot');
    console.log(`🔍 [POST] Bot parameter from URL: "${botParam}" (type: ${typeof botParam})`);
    const useBotUserAgent = botParam === '1';
    console.log(`🔍 [POST] useBotUserAgent calculated: ${useBotUserAgent}`);
    
    if (useBotUserAgent) {
      console.log('🤖 Bot mode enabled: bot=1 parameter detected, will use bot User-Agent');
    } else {
      console.log('👤 Normal mode: no bot parameter or bot!=1, will use normal User-Agent');
    }

    // Parse options with defaults
    const screenshotOptions: ScreenshotOptions = {
      url: targetUrlParam,
      width: options.width || 1920,
      height: options.height || 1080,
      fullPage: options.fullPage || false,
      format: options.format || 'jpeg',
      quality: options.quality || 80,
      waitUntil: options.waitUntil || 'load', // Default to 'load' for fully rendered pages
      timeout: options.timeout || 15000, // Reduced from 30s to 15s for faster processing
      useBotUserAgent: useBotUserAgent === true // Explicitly ensure it's boolean true, not just truthy
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

    // Generate screenshot with retry logic (2 attempts max for faster failure)
    const result = await generateScreenshotWithRetry(screenshotOptions, 2);

    if (!result.success) {
      console.error('❌ Screenshot generation failed after retries:', result.error);
      releaseScreenshotSlot();
      return json({ 
        error: result.error || 'Failed to generate screenshot',
        message: result.message,
        url: targetUrlParam
      }, { status: 500 });
    }

    const screenshot = result.buffer;

    // Return JSON with base64 encoded image (better for WordPress)
    const base64 = screenshot.toString('base64');
    const contentType = screenshotOptions.format === 'png' ? 'image/png' : 'image/jpeg';
    
    releaseScreenshotSlot();
    return json({
      success: true,
      url: targetUrlParam,
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
    releaseScreenshotSlot();
    return json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

/**
 * Resolve redirects manually to avoid browser crashes during redirect handling
 * Returns the final URL after following all redirects
 */
async function resolveRedirects(url: string, maxRedirects: number = 5): Promise<string> {
  let currentUrl = url;
  let redirectCount = 0;
  
  while (redirectCount < maxRedirects) {
    try {
      // Create AbortController for timeout (compatible with older Node.js versions)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            redirectCount++;
            // Handle relative redirects
            try {
              currentUrl = new URL(location, currentUrl).href;
              console.log(`🔄 Redirect ${redirectCount}: ${url} -> ${currentUrl}`);
            } catch {
              // Invalid redirect URL, return current URL
              console.log(`⚠️ Invalid redirect location: ${location}, using current URL`);
              break;
            }
          } else {
            // No location header, return current URL
            break;
          }
        } else {
          // No redirect, return current URL
          break;
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      // If redirect resolution fails, return original URL and let Playwright handle it
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('aborted')) {
        console.log(`⚠️ Redirect resolution timeout for ${url}, will let Playwright handle it`);
      } else {
        console.log(`⚠️ Failed to resolve redirects for ${url}, will let Playwright handle it:`, errorMsg);
      }
      return url;
    }
  }
  
  if (redirectCount >= maxRedirects) {
    console.log(`⚠️ Max redirects (${maxRedirects}) reached for ${url}, using last resolved URL`);
  }
  
  return currentUrl;
}

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
      // Use the detailed message if available, otherwise use the error
      const errorMessage = result.message || result.error || 'Screenshot generation failed';
      lastError = new Error(errorMessage);
      console.log(`⚠️ Attempt ${attempt} failed: ${errorMessage}`, {
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
  const finalErrorMessage = lastError?.message || 'Unknown error';
  console.error(`❌ All ${maxRetries} attempts failed for ${options.url}`, {
    url: options.url,
    attempts: maxRetries,
    lastError: finalErrorMessage,
    stack: lastError?.stack
  });
  return {
    success: false,
    error: 'Screenshot generation failed after all retries',
    message: finalErrorMessage // Use the detailed error message from generateScreenshot
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
            '--disable-ipc-flooding-protection',
            // Additional stability options
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-sync',
            '--disable-default-apps',
            '--disable-component-extensions-with-background-pages',
            '--disable-breakpad',
            '--disable-client-side-phishing-detection',
            '--disable-component-update',
            '--disable-domain-reliability',
            '--disable-features=AudioServiceOutOfProcess',
            '--disable-hang-monitor',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-crash-upload',
            '--no-pings',
            '--password-store=basic',
            '--use-mock-keychain'
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
    
    // Wait longer for browser to fully initialize (especially in serverless environments)
    // Increased from 500ms to 1000ms to give browser more time to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if browser is still connected before creating context
    if (!browser.isConnected()) {
      throw new Error('Browser disconnected immediately after launch (likely due to insufficient resources or /tmp space)');
    }
    
    // Additional check: wait a bit more and verify browser is still alive
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!browser.isConnected()) {
      throw new Error('Browser disconnected during initialization (likely due to resource constraints)');
    }

    let context: any;
    try {
      // Determine User-Agent based on bot=1 parameter
      // If bot=1 is present, use bot User-Agent (required for Real Cookie Manager to hide banners)
      // Otherwise, use normal User-Agent (better quality, no cookie banners for normal users)
      console.log(`🔍 useBotUserAgent value: ${options.useBotUserAgent} (type: ${typeof options.useBotUserAgent})`);
      console.log(`🔍 URL: ${options.url}`);
      
      // Explicitly check for true (not just truthy) to ensure we only use bot when explicitly requested
      const useBotUserAgent = options.useBotUserAgent === true;
      
      const userAgent = useBotUserAgent
        ? 'Mozilla/5.0 (compatible; ScreenshotBot/1.0; +https://culoca.com/bot)'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      
      console.log(`🔍 Selected User-Agent: ${useBotUserAgent ? 'BOT' : 'NORMAL'}`);
      
      context = await browser.newContext({
        viewport: {
          width: options.width || 1920,
          height: options.height || 1080
        },
        userAgent
      });
      
      if (useBotUserAgent) {
        console.log('✅ Browser context created with bot User-Agent (for Real Cookie Manager)');
      } else {
        console.log('✅ Browser context created with normal User-Agent (better quality)');
      }
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

    // Resolve redirects manually to avoid browser crashes during redirect handling
    // This is especially important for URLs that redirect (e.g., aumin.de -> www.aumin.de)
    console.log('🔍 Resolving redirects for:', options.url);
    let finalUrl = options.url;
    try {
      finalUrl = await resolveRedirects(options.url);
      if (finalUrl !== options.url) {
        console.log(`✅ Redirect resolved: ${options.url} -> ${finalUrl}`);
      } else {
        console.log('✅ No redirects found, using original URL');
      }
    } catch (error) {
      console.log(`⚠️ Redirect resolution failed, using original URL:`, error instanceof Error ? error.message : String(error));
      finalUrl = options.url; // Fallback to original URL
    }

    console.log('🌐 Navigating to:', finalUrl);

    // Check browser and page state before navigation
    if (!browser.isConnected()) {
      throw new Error('Browser disconnected before navigation');
    }
    if (page.isClosed()) {
      throw new Error('Page was closed before navigation');
    }

    // Navigate to URL with fallback strategy
    // For screenshots, we need fully loaded pages (images, stylesheets, etc.)
    // Strategy: Try 'load' first (waits for all resources), then fallback to 'domcontentloaded', then 'commit'
    let navigationSuccess = false;
    
    // Use shorter timeout to prevent hanging (10s instead of 15s for faster failure detection)
    const navigationTimeout = Math.min(options.timeout || 10000, 10000);
    
    // Strategy 1: Try 'load' event (waits for all resources - images, stylesheets, etc.)
    // This is better for screenshots as it ensures the page is fully rendered
    try {
      // Check browser connection before navigation
      if (!browser.isConnected() || page.isClosed()) {
        throw new Error('Browser or page closed before navigation attempt');
      }
      
      await page.goto(finalUrl, {
        waitUntil: 'load',
        timeout: navigationTimeout
      });
      console.log('✅ Page loaded (load event - all resources loaded)');
      navigationSuccess = true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`⚠️ load event failed: ${errorMsg}, trying domcontentloaded...`);
      
      // Check if browser/page is still alive before retry
      if (!browser.isConnected() || page.isClosed()) {
        throw new Error(`Browser or page closed during navigation: ${errorMsg}`);
      }
      
      // Strategy 2: Try domcontentloaded (faster, but may not wait for all resources)
      try {
        await page.goto(finalUrl, {
          waitUntil: 'domcontentloaded',
          timeout: navigationTimeout
        });
        console.log('✅ Page loaded (domcontentloaded)');
        navigationSuccess = true;
        // Wait longer for resources to load since domcontentloaded doesn't wait for them
        console.log('⏳ Waiting for images and resources to load...');
        await page.waitForTimeout(3000); // Give time for images/stylesheets to load
        console.log('✅ Resources should be loaded now');
      } catch (domError) {
        const domErrorMsg = domError instanceof Error ? domError.message : String(domError);
        console.log(`⚠️ domcontentloaded failed: ${domErrorMsg}, trying commit...`);
        
        // Check if browser/page is still alive before retry
        if (!browser.isConnected() || page.isClosed()) {
          throw new Error(`Browser or page closed during navigation: ${domErrorMsg}`);
        }
        
        // Strategy 3: Try commit (just wait for navigation to start)
        try {
          await page.goto(finalUrl, {
            waitUntil: 'commit',
            timeout: navigationTimeout
          });
          console.log('✅ Page navigation committed');
          // Wait longer for content to load since commit only waits for navigation start
          await page.waitForTimeout(4000);
          navigationSuccess = true;
        } catch (commitError) {
          const commitErrorMsg = commitError instanceof Error ? commitError.message : String(commitError);
          console.error('❌ All navigation strategies failed');
          throw new Error(`Failed to navigate to ${finalUrl}: ${commitErrorMsg}`);
        }
      }
    }
    
    if (!navigationSuccess) {
      throw new Error(`Failed to navigate to ${finalUrl}`);
    }

    console.log('⏳ Waiting for dynamic content and images to fully render...');
    // Wait for dynamic content, lazy-loaded images, and JavaScript-rendered content
    await page.waitForTimeout(2000);
    
    // Wait for images to load (if they're still loading)
    try {
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve; // Resolve even on error to not block
              // Timeout after 2 seconds
              setTimeout(resolve, 2000);
            }))
        );
      });
      console.log('✅ Images loaded');
    } catch (e) {
      console.log('⚠️ Image loading check failed, continuing anyway');
    }

    // Try to remove cookie consent banners with a strict timeout
    // If it fails or takes too long, we'll create the screenshot anyway (with or without cookie banner)
    console.log('🍪 Attempting to remove cookie consent banners (non-blocking, max 1.5s timeout)...');
    
    // Remove cookie banners with timeout - if it takes longer than timeout, skip it
    const removeCookieBannersWithTimeout = async (timeoutMs: number = 1500): Promise<boolean> => {
      return Promise.race([
        (async () => {
          try {
            // Execute cookie banner removal with timeout protection
            await Promise.race([
              page.evaluate(() => {
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
        // Cookie Law Info Plugin specific (WordPress) - prefer "accept_all" over "accept"
        '#wt-cli-accept-all-btn',
        '[data-cli_action="accept_all"]',
        '.wt-cli-accept-all-btn',
        '#cookie_action_close_header',
        '[data-cli_action="accept"]',
        '.cookie_action_close_header',
        '.cli_action_button',
        '.wt-cli-accept-btn',
        'a[data-cli_action="accept_all"]',
        'a[data-cli_action="accept"]',
        'button[data-cli_action="accept_all"]',
        'button[data-cli_action="accept"]',
        // Generic accept buttons
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

      // Special handling for Cookie Law Info Plugin banner
      try {
        const cookieLawInfoBar = document.getElementById('cookie-law-info-bar');
        if (cookieLawInfoBar) {
          // Try to find accept button (prefer "accept_all" over "accept" for better coverage)
          let acceptButton = cookieLawInfoBar.querySelector('#wt-cli-accept-all-btn, [data-cli_action="accept_all"], .wt-cli-accept-all-btn');
          if (!acceptButton) {
            // Fallback to regular accept button
            acceptButton = cookieLawInfoBar.querySelector('#cookie_action_close_header, [data-cli_action="accept"], .cookie_action_close_header, .cli_action_button, .wt-cli-accept-btn');
          }
          
          if (acceptButton) {
            try {
              (acceptButton as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' });
              (acceptButton as HTMLElement).click();
              // Also trigger click event
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              acceptButton.dispatchEvent(clickEvent);
            } catch (e) {
              // If button click fails, remove banner directly
              cookieLawInfoBar.style.display = 'none';
              cookieLawInfoBar.remove();
            }
          } else {
            // No button found, remove banner directly
            cookieLawInfoBar.style.display = 'none';
            cookieLawInfoBar.remove();
          }
        }
      } catch (e) {
        // Ignore errors
      }

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
              text.includes('all accept') ||
              text.includes('annehmen') // German "accept"
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
        #cookie-law-info-bar,
        [id*="cookie" i],
        [class*="cookie" i],
        [id*="consent" i],
        [class*="consent" i],
        [id*="gdpr" i],
        [class*="gdpr" i],
        [role="dialog"][aria-label*="cookie" i],
        [role="dialog"][aria-label*="consent" i],
        .cookie-law-info-bar,
        #cliModalBackDrop,
        .cli-modal-backdrop {
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
      
      // Final check: remove cookie-law-info-bar if still present
      try {
        const remainingBar = document.getElementById('cookie-law-info-bar');
        if (remainingBar) {
          remainingBar.style.display = 'none';
          remainingBar.style.visibility = 'hidden';
          remainingBar.style.opacity = '0';
          remainingBar.style.height = '0';
          remainingBar.style.maxHeight = '0';
          remainingBar.remove();
        }
      } catch (e) {
        // Ignore errors
      }
      }),
              // Timeout for page.evaluate itself (should be faster than outer timeout)
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error('page.evaluate timeout')), Math.min(timeoutMs - 200, 1000));
              })
            ]);
            return true; // Success
          } catch (error) {
            console.warn('⚠️ Cookie banner removal failed (non-critical):', error instanceof Error ? error.message : String(error));
            return false; // Failed but non-critical
          }
        })(),
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            console.log(`⏰ Cookie banner removal timeout after ${timeoutMs}ms, proceeding with screenshot`);
            resolve(false);
          }, timeoutMs);
        })
      ]);
    };

    // Try to remove cookie banners quickly (max 1.5 seconds total timeout)
    // If it fails or takes too long, immediately proceed with screenshot
    try {
      const cookieRemovalStart = Date.now();
      const result = await removeCookieBannersWithTimeout(1500); // 1.5 second timeout - if it takes longer, skip it
      if (result) {
        console.log('✅ Cookie banner removal: success');
        await page.waitForTimeout(300); // Brief wait for banner animations/closing
      } else {
        const elapsed = Date.now() - cookieRemovalStart;
        console.log(`⚠️ Cookie banner removal failed or timed out after ${elapsed}ms, proceeding immediately with screenshot (may include cookie banner)`);
      }
    } catch (error) {
      // Non-critical: continue with screenshot even if cookie banner removal fails
      console.warn('⚠️ Cookie banner removal encountered error (non-critical, continuing immediately):', error instanceof Error ? error.message : String(error));
    }

    console.log('📸 Taking screenshot...');
    
    // Check if browser is still connected before taking screenshot
    if (!browser.isConnected()) {
      throw new Error('Browser disconnected before screenshot. This may indicate resource constraints or browser crash.');
    }
    
    // Check if page is still open
    if (page.isClosed()) {
      throw new Error('Page was closed before screenshot. This may indicate navigation failure or page crash.');
    }
    
    // Take screenshot
    const screenshotOptions: any = {
      type: options.format || 'jpeg',
      fullPage: options.fullPage || false
    };

    if (options.format === 'jpeg' && options.quality) {
      screenshotOptions.quality = options.quality;
    }

    // Take screenshot with timeout protection
    const screenshotTimeout = 10000; // 10 seconds max for screenshot
    const buffer = await Promise.race([
      page.screenshot(screenshotOptions),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Screenshot timeout: Taking screenshot took too long')), screenshotTimeout);
      })
    ]);

    console.log('✅ Screenshot taken, size:', buffer.length, 'bytes');

    // Always close browser, even on success
    // Wait for browser to fully close to prevent resource leaks
    try {
      // Close all pages first
      const pages = await browser.pages();
      await Promise.all(pages.map(page => page.close().catch(() => {})));
      
      // Then close browser
      await browser.close();
      
      // Wait a bit to ensure browser process is fully terminated
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('✅ Browser closed successfully');
    } catch (closeError) {
      console.warn('⚠️ Error closing browser after success:', closeError instanceof Error ? closeError.message : String(closeError));
      // Try to force kill browser process if normal close fails
      try {
        if (browser.process && browser.process().pid) {
          process.kill(browser.process().pid, 'SIGKILL');
          console.log('⚠️ Force-killed browser process after success');
        }
      } catch (killError) {
        // Ignore kill errors
      }
    }
    
    return {
      success: true,
      buffer
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : String(error);
    
    // Determine error type for better error messages
    let errorType = 'Unknown error';
    let detailedMessage = errorMessage;
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      errorType = 'Navigation timeout';
      detailedMessage = `Page took too long to load (timeout: ${options.timeout}ms). The page may be slow or have blocking resources.`;
    } else if (errorMessage.includes('net::ERR') || errorMessage.includes('net::')) {
      errorType = 'Network error';
      detailedMessage = `Network error while loading page: ${errorMessage}`;
    } else if (errorMessage.includes('Target page, context or browser has been closed')) {
      errorType = 'Browser closed';
      detailedMessage = 'Browser instance was closed unexpectedly. This may indicate resource constraints.';
    } else if (errorMessage.includes('Protocol error') || errorMessage.includes('Session closed')) {
      errorType = 'Browser protocol error';
      detailedMessage = `Browser communication error: ${errorMessage}`;
    }
    
    console.error(`❌ Error generating screenshot (${errorType}):`, detailedMessage);
    console.error('❌ Error stack:', errorStack);
    
    // Always try to close browser, even on error
    if (browser) {
      try {
        // Give browser a moment to stabilize before closing
        await new Promise(resolve => setTimeout(resolve, 100));
        await browser.close();
        console.log('✅ Browser closed after error');
      } catch (closeError) {
        console.error('❌ Error closing browser:', closeError instanceof Error ? closeError.message : String(closeError));
        // Force kill if normal close fails (in case browser is hung)
        try {
          if (browser.process && browser.process().pid) {
            process.kill(browser.process().pid, 'SIGKILL');
            console.log('⚠️ Force-killed browser process');
          }
        } catch (killError) {
          // Ignore kill errors
        }
      }
    }
    
    return {
      success: false,
      error: `Screenshot generation failed: ${errorType}`,
      message: detailedMessage
    };
  }
}

