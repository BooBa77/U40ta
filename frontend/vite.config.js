import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'development' 
          ? 'http://backend:3000'  // Docker Compose
          : 'http://localhost:3000', // Продакшен
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  // Добавляем для корректных путей в продакшене
  base: process.env.NODE_ENV === 'production' ? '/' : '/'
})