import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
    registerType: 'autoUpdate',
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    manifest: {
        name: 'AWARE Sim',
        short_name: 'AWARE',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b132b',
        theme_color: '#1c2541',
        icons: [{ src: '/icon-192x192.svg', sizes:'192x192', type:'image/svg+xml' },
                { src: '/icon-512x512.svg', sizes:'512x512', type:'image/svg+xml' }]
    },
    workbox: {
        runtimeCaching: [
        {
            urlPattern: ({url}) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/alerts'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'aware-api' }
        },
        {
            urlPattern: ({url}) => ['/api/alerts','/api/emergency','/api/shelters'].some(p=>url.pathname.startsWith(p)),
            handler: 'NetworkFirst',
            options: { cacheName: 'aware-alerts' }
        },
        {
            urlPattern: ({request}) => ['style','script','image','font','document'].includes(request.destination),
            handler: 'CacheFirst',
            options: { cacheName: 'aware-static' }
        }
        ]
    }
    })
  ],
  resolve: {
    alias: {
      '@sim': '/src/sim',
      '@ui': '/src/ui'
    }
  }
});
