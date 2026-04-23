import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: 'localhost',
    port: 5180,
    strictPort: true,
    proxy: {
      '/auth': 'http://localhost:8787',
      '/api': 'http://localhost:8787',
    },
    hmr: {
      host: 'local.leggo.csullivan.me',
      protocol: 'wss',
      clientPort: 443,
    },
    allowedHosts: ['local.leggo.csullivan.me'],
  },
});
