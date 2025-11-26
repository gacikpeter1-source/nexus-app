/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF3366',
        'primary-dark': '#FF1744',
        secondary: '#FFD700',
        dark: '#0A0E27',
        'mid-dark': '#1A1F3A',
        light: '#F8F9FA',
        accent: '#00D9FF',
        'accent-dark': '#0099CC',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        title: ['Bebas Neue', 'sans-serif'],
        body: ['Work Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
