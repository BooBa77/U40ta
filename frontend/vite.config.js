import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    // PWA: свой service worker (src/sw.js) + манифест.
    // Манифест раньше лежал руками в public/manifest.json, а SW — мёртвым
    // файлом public/sw.js, который никто не регистрировал. Теперь и то,
    // и другое собирает плагин: он же вставляет в index.html ссылку на
    // манифест и скрипт регистрации registerSW.js.
    VitePWA({
      // Свой SW через injectManifest — полный контроль над логикой обновления
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // Не обновляем автоматически — рулим вручную через useSwUpdate
      registerType: 'prompt',

      // В dev PWA полностью выключена (никакого SW, никакого манифеста)
      devOptions: {
        enabled: false
      },

      manifest: {
        id: '/',
        name: 'U40TA',
        short_name: 'U40TA',
        description: 'Учёт оргтехники и материальных ценностей',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0088cc',
        background_color: '#ffffff',
        lang: 'ru',
        // Пути без ведущего слэша: так их пишет генератор манифеста,
        // и они разрешаются относительно start_url
        icons: [
          {
            src: 'icons/192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

      injectManifest: {
        // Что кладём в precache при сборке
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'development' 
          ? 'http://backend:3000'  // Docker Compose
          : 'http://localhost:3000', // Продакшен
        changeOrigin: true
      }
    },
    // для Hot Reload в Docker на Windows  ← ДОБАВИТЬ ЗАПЯТУЮ
    watch: process.env.NODE_ENV === 'development'
      ? {
          usePolling: true,
          interval: 1000
        } 
      : undefined
  },  // ← ЭТА скобка закрывает server

  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  // Добавляем для корректных путей в продакшене
  base: process.env.NODE_ENV === 'production' ? '/' : '/'
})