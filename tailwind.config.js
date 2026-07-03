/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './walkin.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#D95A2B',
          black: '#1A1A1A',
          panel: '#F5F5F0',
          edge: '#E8E8E0',
          ui: '#FAF9F7',
        },
      },
    },
  },
  plugins: [],
};
