/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paypal: {
          blue: '#003087',
          dark: '#001C64',
          yellow: '#FFC439',
          gold: '#F2BA36'
        }
      }
    },
  },
  plugins: [],
}