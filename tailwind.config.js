/**
 * Tailwind v4 reads its theme from CSS (`@theme` in src/index.css); this file is not loaded
 * unless referenced with `@config`. It mirrors the 8-bit palette and fonts for editor tooling.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        px: {
          black: '#000000',
          navy: '#1b1464',
          dim: '#9a9aff',
          white: '#ffffff',
          cyan: '#33e6ff',
          green: '#4dff6a',
          yellow: '#ffe033',
          red: '#ff5470',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'ui-monospace', 'monospace'],
        terminal: ['VT323', 'ui-monospace', 'monospace'],
        sans: ['VT323', 'ui-monospace', 'monospace'],
      },
      borderRadius: { none: '0' },
    },
  },
  plugins: [],
};
