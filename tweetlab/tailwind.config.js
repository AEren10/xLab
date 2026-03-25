/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0b',
        card: '#111113',
        elevated: '#18181c',
        accent: '#7c6af7',
        'accent-green': '#4ade80',
        'accent-yellow': '#facc15',
        'accent-orange': '#fb923c',
        'accent-red': '#f87171',
      },
    },
  },
  plugins: [],
};
