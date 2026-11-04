import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
  plugins: [tailwindcss(), react()],
  build: {
    // Optimize bundle size and build performance
    target: 'esnext',
    // Use esbuild for minification (faster than terser, smaller bundle)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Code splitting for better caching and parallel loading
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'react-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
    // Source maps disabled for smaller bundle (enable for production debugging if needed)
    sourcemap: false,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  // Performance optimizations
  server: {
    // Enable compression during development
    middlewareMode: false,
  },
  }
})
