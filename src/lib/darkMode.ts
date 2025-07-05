import { writable } from 'svelte/store';

// Initialize dark mode from localStorage or default to false
const getInitialDarkMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('darkMode');
    return stored === 'true';
  }
  return false;
};

export const darkMode = writable<boolean>(getInitialDarkMode());

// Function to apply theme to DOM
function applyTheme(isDark: boolean) {
  if (typeof window !== 'undefined') {
    const html = document.documentElement;
    if (isDark) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
  }
}

// Subscribe to changes and save to localStorage + apply theme
if (typeof window !== 'undefined') {
  darkMode.subscribe((value) => {
    localStorage.setItem('darkMode', value ? 'true' : 'false');
    applyTheme(value);
  });
  
  // Apply initial theme
  applyTheme(getInitialDarkMode());
} 