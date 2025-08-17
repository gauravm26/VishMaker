// app-ui/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths()
  ],

  // Ensure assets use relative paths for CloudFront compatibility
  base: './',
  build: {
    // Generate source maps for debugging in production
    sourcemap: true,
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          flow: ['reactflow']
        }
      }
    }
  },
  // Enable environment variable replacement
  define: {
    __DEV__: JSON.stringify(true)
  }
})
