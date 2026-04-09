import { writable } from 'svelte/store';

// Initialize dark mode from localStorage or default to true (for better anonymous UX)
const getInitialDarkMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
    return stored === 'true';
    }
    // Default to dark mode for new users (better UX)
    return true;
  }
  return true; // Default to dark mode
};

export const darkMode = writable<boolean>(getInitialDarkMode());

// Function to apply theme to DOM (<html> + <body>, damit :global(body[data-theme]) greift)
function applyTheme(isDark: boolean) {
  if (typeof window === 'undefined') return;
  const html = document.documentElement;
  const body = document.body;
  if (isDark) {
    html.setAttribute('data-theme', 'dark');
    body?.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
    body?.removeAttribute('data-theme');
  }
}

// Subscribe to changes and save to localStorage + apply theme
if (typeof window !== 'undefined') {
  // Set initial value to localStorage if not present
  const stored = localStorage.getItem('darkMode');
  if (stored === null) {
    localStorage.setItem('darkMode', 'true');
  }
  
  darkMode.subscribe((value) => {
    localStorage.setItem('darkMode', value ? 'true' : 'false');
    applyTheme(value);
  });
  
  // Apply initial theme (body ggf. erst nach DOMContentLoaded)
  const run = () => applyTheme(getInitialDarkMode());
  run();
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
} 