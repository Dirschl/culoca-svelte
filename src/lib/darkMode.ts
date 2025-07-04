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

// Subscribe to changes and save to localStorage
if (typeof window !== 'undefined') {
  darkMode.subscribe((value) => {
    localStorage.setItem('darkMode', value ? 'true' : 'false');
  });
} 