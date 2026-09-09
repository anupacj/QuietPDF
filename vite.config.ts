import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        legal: resolve(rootDir, 'legal/index.html'),
        healthcare: resolve(rootDir, 'healthcare/index.html'),
        hr: resolve(rootDir, 'hr/index.html'),
      },
    },
  },
});
