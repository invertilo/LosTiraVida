import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The folder name contains "#", which breaks Vite's dev server. `npm run dev` (scripts/dev.mjs)
// launches Vite through a "#"-free symlink and passes it here as VITE_DEV_ROOT. Builds are unaffected.
const devRoot = process.env.VITE_DEV_ROOT

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const safeRoot = command === 'serve' ? devRoot : undefined
  return {
  ...(safeRoot
    ? {
        root: safeRoot,
        resolve: { preserveSymlinks: true },
      }
    : {}),
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
    // Symlinked dev root: macOS FS events report the real ("#") path, which never matches the
    // symlinked module ids, so HMR would serve stale code. Polling reports paths as watched.
    ...(safeRoot ? { watch: { usePolling: true, interval: 120 } } : {}),
    // Enable compression during development
    middlewareMode: false,
  },
  }
})
