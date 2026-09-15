import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// BASE_PATH lets static hosts under a sub-path (e.g. GitHub Pages) override the
// base; local dev and root hosting default to "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    {
      // public/sw.js ships with a __APP_VERSION__ token in its cache name;
      // stamp the real version into the copied file after the build.
      name: 'hex-breaker-sw-version',
      apply: 'build',
      writeBundle(options) {
        const out = join(options.dir ?? 'dist', 'sw.js');
        writeFileSync(out, readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8').replaceAll('__APP_VERSION__', pkg.version));
      },
    },
  ],
  build: {
    target: 'es2019',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
  },
});
