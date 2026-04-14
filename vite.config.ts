import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/xquik': {
        target: 'https://xquik.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xquik/, '/api/v1'),
      },
    },
  },
})
