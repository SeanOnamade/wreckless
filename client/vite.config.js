import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    target: 'es2018',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'socket': ['socket.io-client'],
          'rapier': ['@dimforge/rapier3d-compat']
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173
  },
  assetsInclude: ['**/*.glb']
}) 