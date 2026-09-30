/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#06080e',
          900: '#0b101b',
          850: '#101726',
          800: '#161f32',
          700: '#212d45',
          600: '#324263'
        },
        cyber: {
          blue: '#00f0ff',
          green: '#10b981',
          red: '#f43f5e',
          amber: '#f59e0b',
          purple: '#a855f7'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
