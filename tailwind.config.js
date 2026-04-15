/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07080b',
        card: '#10141b',
        elevated: '#171c26',
        accent: '#8a7cff',
        'accent-green': '#55d691',
        'accent-yellow': '#f2c95e',
        'accent-orange': '#ff9f57',
        'accent-red': '#ff7d7d',
      },
    },
  },
  plugins: [],
};
