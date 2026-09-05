import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Consume workspace packages as source, like web and admin do.
      '@synqit/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      // Order matters: the stylesheet alias must precede the package alias.
      '@synqit/ui/tokens.css': path.resolve(__dirname, '../../packages/ui/src/tokens.css'),
      // Order matters: the stylesheet alias must precede the package alias.
      '@synqit/ui/tokens.css': path.resolve(__dirname, '../../packages/ui/src/tokens.css'),
      '@synqit/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@synqit/client': path.resolve(__dirname, '../../packages/client/src/index.ts'),
      '@synqit/i18n': path.resolve(__dirname, '../../packages/i18n/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@synqit/shared', '@synqit/ui', '@synqit/client', '@synqit/i18n'],
  },
  publicDir: path.resolve(__dirname, '../web/public'),
  server: {
    host: '127.0.0.1',
    port: 4173,
    open: true,
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
});
