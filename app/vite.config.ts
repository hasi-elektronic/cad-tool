import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'HASI CAD',
        short_name: 'HASI CAD',
        description: 'Browser-based 2D Technical Drawing Editor',
        theme_color: '#33afe2',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
