import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Treat shared workspace code as source during web dev to avoid dep-optimizer churn.
      '@synqit/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@synqit/shared'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react-vendor';
            }

            if (id.includes('@tanstack/react-router')) {
              return 'router-vendor';
            }

            if (
              id.includes('/framer-motion/') ||
              id.includes('/motion-dom/') ||
              id.includes('/motion-utils/')
            ) {
              return 'motion-vendor';
            }

            if (id.includes('/lucide-react/')) {
              return 'icons-vendor';
            }
          }

          if (id.includes('/packages/shared/src/')) {
            return 'shared-schemas';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
});
