import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'giglog.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS concerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist TEXT NOT NULL,
    venue TEXT,
    city TEXT,
    date TEXT,
    price REAL,
    rating INTEGER,
    notes TEXT,
    last_minute INTEGER DEFAULT 0,
    setlist_fm_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS upcoming (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist TEXT NOT NULL,
    venue TEXT,
    city TEXT,
    date TEXT,
    price REAL,
    section TEXT,
    last_minute INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist TEXT NOT NULL,
    priority TEXT DEFAULT 'want_to_see',
    max_price REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS setlist_cache (
    cache_key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_usage (
    date TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS concert_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concert_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    caption TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS external_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concert_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    url TEXT NOT NULL,
    label TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS geocode_cache (
    city TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations for new columns (safe to run multiple times)
const migrations = [
  "ALTER TABLE concerts ADD COLUMN setlist_fm_url TEXT",
  "ALTER TABLE concerts ADD COLUMN ticket_art_svg TEXT",
  "ALTER TABLE upcoming ADD COLUMN ticket_art_svg TEXT",
  "ALTER TABLE concerts ADD COLUMN youtube_url TEXT",
  "ALTER TABLE concerts ADD COLUMN youtube_match TEXT",  // 'exact', 'tour', or null
  "ALTER TABLE concerts ADD COLUMN ticket_image TEXT",
  "ALTER TABLE upcoming ADD COLUMN ticket_image TEXT",
  "ALTER TABLE concerts ADD COLUMN parent_concert_id INTEGER",
  "ALTER TABLE concerts ADD COLUMN display_order INTEGER DEFAULT 0",
];

for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

export default db;
