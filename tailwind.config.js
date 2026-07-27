/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue"
  ],
  theme: {
    extend: {
      colors: {
        gemini: {
          dark: '#0a0c16',
          panel: 'rgba(20, 24, 45, 0.75)',
          border: 'rgba(139, 92, 246, 0.25)',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          blue: '#3b82f6',
          pink: '#ec4899',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 25px rgba(139, 92, 246, 0.35)',
        cyanGlow: '0 0 25px rgba(6, 182, 212, 0.35)',
      }
    },
  },
  plugins: [],
}
