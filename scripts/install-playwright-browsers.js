#!/usr/bin/env node
/**
 * Install Playwright browsers for Vercel deployment
 * Only runs on Linux (Vercel) or when VERCEL env var is set
 */

import { execSync } from 'child_process';
import os from 'os';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.VERCEL_URL;
const isLinux = os.platform() === 'linux';
const isCI = process.env.CI === 'true';

console.log('🔍 Environment check:', {
  isVercel,
  isLinux,
  isCI,
  platform: os.platform(),
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
  CI: process.env.CI
});

// Always try to install on Linux (Vercel uses Linux)
if (isVercel || isLinux || isCI) {
  console.log('📦 Installing Playwright browsers for production...');
  console.log('📦 Running: npx playwright install chromium chromium-headless-shell --with-deps');
  try {
    // Install both chromium and chromium-headless-shell (needed for some modes)
    execSync('npx playwright install chromium chromium-headless-shell --with-deps', {
      stdio: 'inherit',
      env: { 
        ...process.env, 
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0',
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '0'
      },
      cwd: process.cwd()
    });
    console.log('✅ Playwright browsers installed successfully');
  } catch (error) {
    console.error('❌ Failed to install Playwright browsers:', error);
    console.error('❌ Error message:', error.message);
    // Don't fail the build if browser installation fails, but log the error
    console.warn('⚠️ Continuing build despite browser installation failure');
    process.exit(0);
  }
} else {
  console.log('⏭️  Skipping Playwright browser installation (not on Linux/Vercel)');
  console.log('⏭️  Platform:', os.platform(), 'VERCEL:', process.env.VERCEL);
}

