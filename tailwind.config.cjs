/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        'culoca-orange': '#ee7221',
        'culoca-orange-dark': '#d6641c',
      },
    },
  },
  plugins: [],
} 