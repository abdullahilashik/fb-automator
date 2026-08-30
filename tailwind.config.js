/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./entrypoints/**/*.{js,jsx}",
    "./styles/**/*.{js,jsx,ts,tsx}",
    "./utils/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}