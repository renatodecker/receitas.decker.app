/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f7ed',
          100: '#e6edd6',
          200: '#cddcae',
          300: '#aec87f',
          400: '#8fb058',
          500: '#6f9639',
          600: '#56762b',
          700: '#425a22',
          800: '#37481f',
          900: '#2f3d1d',
        },
        accent: {
          50: '#fdf4ee',
          100: '#fbe4d4',
          200: '#f6c6a3',
          300: '#efa06a',
          400: '#e77c3f',
          500: '#d95f22',
          600: '#b8481b',
          700: '#94391a',
          800: '#772f1a',
          900: '#622918',
        },
      },
      fontFamily: {
        sans: ['"Nunito"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
