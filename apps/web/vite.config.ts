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
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true,
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
});
