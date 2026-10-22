import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // API-Tests laufen gegen In-Memory-SQLite (unabhaengig von lokalen Dateien)
    env: { DART_DB_PATH: ':memory:' },
    fileParallelism: false
  }
});
