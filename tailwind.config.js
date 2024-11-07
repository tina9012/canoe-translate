/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-gray': '#1a1a1a',
        'accent-blue': '#4f7fff',
        'accent-teal': '#2dd4bf',
        'error-red': '#ff4f4f',
      },
      backgroundImage: {
        'gradient-to-br': 'linear-gradient(to bottom right, #1a1a1a, #222831, #3a3d46)',
      },
      minHeight: {
        'screen-70': '70vh',
      },
      boxShadow: {
        '3xl': '0 15px 30px rgba(0, 0, 0, 0.3)',
      },
      transitionTimingFunction: {
        'in-out-soft': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
