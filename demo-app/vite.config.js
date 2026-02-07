import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    nodePolyfills({
      // Enable polyfills for zlib and other node modules
      include: ['zlib', 'stream', 'buffer', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  resolve: {
    alias: {
      // Use browser-specific just-bash build
      'just-bash': 'just-bash/browser'
    }
  },
  optimizeDeps: {
    exclude: ['just-bash']
  }
})

