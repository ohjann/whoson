import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: {
        name: 'WhosOn',
        short_name: 'WhosOn',
        description: 'Festival schedule companion',
        theme_color: '#0d0d1a',
        background_color: '#0d0d1a',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/offline/',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|avif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/clashfinder-proxy': {
        target: 'https://clashfinder.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/clashfinder-proxy/, ''),
        configure: (proxy) => {
          // Follow redirects server-side so the browser doesn't chase them outside the proxy
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              const location = proxyRes.headers.location;
              // Rewrite absolute clashfinder.com redirects to go through the proxy
              if (location.includes('clashfinder.com')) {
                const url = new URL(location);
                proxyRes.headers.location = `/clashfinder-proxy${url.pathname}${url.search}`;
              }
            }
          });
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    globals: true
  }
});
