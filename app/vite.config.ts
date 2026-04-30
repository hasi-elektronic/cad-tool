import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: (globalThis as any).process?.env?.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'HASI CAD',
        short_name: 'HASI CAD',
        description: 'Browser-basierter 2D-Zeichnungseditor',
        lang: 'de',
        theme_color: '#33afe2',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        // OS-Datei-Zuordnung: nach Installation als PWA kann der Nutzer eine
        // .dxf-Datei im Datei-Explorer per "Öffnen mit → HASI CAD" auswählen.
        // Casting weitet den begrenzten Manifest-Typ um die Felder, die
        // Chromium unterstützt (icons / launch_type) ohne TS-Fehler.
        file_handlers: [
          {
            action: '.',
            accept: {
              'application/dxf': ['.dxf'],
              'image/vnd.dxf': ['.dxf'],
              'application/x-dxf': ['.dxf'],
              'text/plain': ['.dxf'],
            },
            icons: [
              { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
            ],
            launch_type: 'single-client',
          },
        ] as never,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
