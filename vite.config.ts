/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { speciesPlugin } from './scripts/vite-plugin-species.ts'

// Countries and territories on the world map, for the headline. Venom Atlas
// and Poison Atlas share the map, so they show the same number.
const mapCountries = (
  JSON.parse(readFileSync(new URL('./public/geo/countries.json', import.meta.url), 'utf8')) as {
    features: unknown[]
  }
).features.length

export default defineConfig({
  define: { __MAP_COUNTRIES__: mapCountries },
  plugins: [
    vue(),
    tailwindcss(),
    speciesPlugin(),
    // Installable, and usable offline: the app itself and the world map are
    // cached on first visit; each country's states, the record dots and the
    // photos are cached as they're viewed.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Poison Atlas',
        short_name: 'Poison Atlas',
        description:
          'An interactive world map of poisonous plants, fungi, and animals by country and state, with a source for every claim.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f2ea',
        theme_color: '#fffdf8',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png}',
          'geo/countries.json',
          'geo/rivers.json',
          'geo/lakes.json',
        ],
        // The social preview image isn't needed offline.
        globIgnores: ['og.png'],
        // Direct visits to a data file, the sitemap or robots.txt get the file,
        // not the app.
        navigateFallbackDenylist: [/^\/(geo|occurrence|icons)\//, /^\/(sitemap\.xml|robots\.txt)$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /^\/(geo|occurrence)\//.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'data', expiration: { maxEntries: 800 } },
          },
          {
            // Photos come from Wikimedia's and iNaturalist's CDNs, as opaque
            // (no-CORS) responses.
            urlPattern: ({ url }) =>
              url.hostname === 'upload.wikimedia.org' ||
              url.hostname === 'inaturalist-open-data.s3.amazonaws.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'photos',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    // `@/lib` rather than `../../lib`. Mirrored in tsconfig.app.json paths —
    // both have to agree or the editor and the build disagree about imports.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // MapLibre's worker is an ES module (see AtlasMap.vue).
  worker: { format: 'es' },
  build: {
    // MapLibre is one ~800 kB module that can't be split further; it is loaded
    // once and cached. Raising the limit to just above it keeps the warning
    // meaningful for everything else.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
