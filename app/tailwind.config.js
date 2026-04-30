/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#33afe2',
        canvas: '#1e1e1e',
        ink: '#e8eef7',
        muted: '#8a93a8',
        panel: '#262626',
        panel2: '#2f2f2f',
        line: '#3a3a3a',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
