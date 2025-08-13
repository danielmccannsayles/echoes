import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    assetsInlineLimit: 0, // Don't inline assets
    rollupOptions: {
      output: {
        // Use relative imports
        format: 'es'
      }
    }
  },
  base: './' // Use relative paths
})
