import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Tests importieren public/js/caller-voice.js direkt -> publicDir aus, sonst
  // blockiert Vite Importe aus /public ("non-asset file inside /public").
  publicDir: false,
  resolve: {
    // public/js/caller-voice.js importiert mit Browser-Absolutpfaden '/js/core/...'
    // -> in Tests auf die pure-Module in src/ mappen.
    alias: [{ find: /^\/js\/core\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }]
  },
  test: {
    environment: 'node',
    // API-Tests laufen gegen In-Memory-SQLite (unabhaengig von lokalen Dateien)
    env: { DART_DB_PATH: ':memory:' },
    fileParallelism: false
  }
});
