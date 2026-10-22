// SQLite (node:sqlite) — Schema additiv, DB-File NUR am Server (nie im rsync-Weg loeschen).
// process.getBuiltinModule: keine Modulauflösung, funktioniert unter Vitest/ESM sauber.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function openDb(path) {
  const dbPath = path || process.env.DART_DB_PATH || join(root, 'server', 'data', 'dart.db');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      pass_hash TEXT NOT NULL,
      friend_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      friend_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE(user_id, friend_id)
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      guest_id INTEGER NOT NULL REFERENCES users(id),
      config TEXT NOT NULL,
      state TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      winner_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS synced_games (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      game TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_synced_owner ON synced_games(owner_id, date);
    CREATE INDEX IF NOT EXISTS idx_matches_owner ON matches(owner_id, status);
    CREATE INDEX IF NOT EXISTS idx_matches_guest ON matches(guest_id, status);
  `);
  return db;
}
