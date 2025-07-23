import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Create writable store for welcome visibility
export const welcomeVisible = writable(true);

// Initialize from localStorage if available
if (browser) {
  const stored = localStorage.getItem('welcomeVisible');
  if (stored !== null) {
    welcomeVisible.set(stored === 'true');
  }
}

// Subscribe to changes and save to localStorage
if (browser) {
  welcomeVisible.subscribe((value) => {
    localStorage.setItem('welcomeVisible', value.toString());
  });
}

// Function to hide welcome section
export function hideWelcome() {
  welcomeVisible.set(false);
}

// Function to show welcome section
export function showWelcome() {
  welcomeVisible.set(true);
}

// Function to permanently dismiss welcome (don't show again)
export function dismissWelcome() {
  welcomeVisible.set(false);
  if (browser) {
    localStorage.setItem('welcomeDismissed', 'true');
  }
}

// Check if welcome was permanently dismissed
export function isWelcomeDismissed(): boolean {
  if (!browser) return false;
  return localStorage.getItem('welcomeDismissed') === 'true';
}

// Reset welcome (show again)
export function resetWelcome() {
  welcomeVisible.set(true);
  if (browser) {
    localStorage.removeItem('welcomeDismissed');
  }
} 