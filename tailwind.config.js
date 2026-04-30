/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#33afe2',
        canvas: '#1a1a2e',
        ink: '#e8eef7',
        muted: '#8a93a8',
        panel: '#22223a',
        panel2: '#2c2c47',
        line: '#3a3a5a',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
