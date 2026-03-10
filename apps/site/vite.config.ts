import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
