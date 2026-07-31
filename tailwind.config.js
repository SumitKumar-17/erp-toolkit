/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#5c6ac4',
        secondary: '#ecc94b',
        upcoming: '#16a34a',
        warning: '#d97706',
        overdue: '#dc2626'
      }
    }
  },
  darkMode: 'class',
  plugins: [require('@tailwindcss/forms')]
}
