import { defineConfig } from 'vite';

// base './' lets the built site work from any sub-path (GitHub Pages, a folder on a server, etc.).
export default defineConfig({
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 800 },
});
