import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The giscus theme is fetched by giscus.app through Cloudflare, which caches CSS for hours.
// Its URL carries a hash of the file so a changed theme gets a new URL and skips stale caches.
const giscusThemeVersion = createHash('sha256')
  .update(readFileSync(new URL('./public/giscus-theme.css', import.meta.url)))
  .digest('hex')
  .slice(0, 10);

// base './' lets the built site work from any sub-path (GitHub Pages, a folder on a server, etc.).
export default defineConfig({
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 800 },
  define: { __GISCUS_THEME_VERSION__: JSON.stringify(giscusThemeVersion) },
});
