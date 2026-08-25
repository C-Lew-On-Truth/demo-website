import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // Only needed for a GitHub Pages build (served from /demo-website/) -
  // local dev should just be plain localhost:3000.
  base: command === 'build' ? '/demo-website/' : '/',
  plugins: [tailwindcss(), vue()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
}))
