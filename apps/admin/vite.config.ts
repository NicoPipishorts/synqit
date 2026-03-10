import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Treat shared workspace code as source to keep admin aligned with web builds.
      '@synqit/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@synqit/shared'],
  },
  publicDir: path.resolve(__dirname, '../web/public'),
  server: {
    host: '127.0.0.1',
    port: 4174,
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
