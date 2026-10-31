/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B132B',
          800: '#1C2541',
          700: '#3A506B',
          600: '#4A6572',
        },
        brand: {
          blue: '#1E40AF',
          lightBlue: '#3B82F6',
          sky: '#60A5FA',
          teal: '#0D9488',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444',
          slate: '#64748B'
        }
      }
    },
  },
  plugins: [],
}