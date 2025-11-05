#!/usr/bin/env node
/**
 * Install Playwright browsers for Vercel deployment
 * Only runs on Linux (Vercel) or when VERCEL env var is set
 */

import { execSync } from 'child_process';
import os from 'os';

const isVercel = process.env.VERCEL === '1';
const isLinux = os.platform() === 'linux';

if (isVercel || isLinux) {
  console.log('📦 Installing Playwright browsers for production...');
  try {
    execSync('playwright install chromium --with-deps', {
      stdio: 'inherit',
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0' }
    });
    console.log('✅ Playwright browsers installed successfully');
  } catch (error) {
    console.warn('⚠️ Failed to install Playwright browsers:', error.message);
    // Don't fail the build if browser installation fails
    process.exit(0);
  }
} else {
  console.log('⏭️  Skipping Playwright browser installation (not on Linux/Vercel)');
}

