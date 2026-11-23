/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Arial Narrow"', 'Arial', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};
