import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

// Used by Ladle (and any other Vite tooling in this package). Mirrors the apps'
// aliases so workspace packages are consumed as source.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@synqit/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@synqit/shared'],
  },
});
