import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production, use persistent volume; locally, use project root
const dataDir = process.env.NODE_ENV === 'production' && fs.existsSync('/app/data')
  ? '/app/data'
  : path.join(__dirname, '..');
const dbPath = path.join(dataDir, 'giglog.db');

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

  CREATE TABLE IF NOT EXISTS seatgeek_cache (
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

  CREATE TABLE IF NOT EXISTS dismissed_artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist TEXT NOT NULL UNIQUE,
    dismissed_at TEXT DEFAULT (datetime('now'))
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
  "ALTER TABLE wishlist ADD COLUMN url TEXT",
  "ALTER TABLE concerts ADD COLUMN tour_name TEXT",
  "ALTER TABLE concerts ADD COLUMN end_date TEXT",
  "ALTER TABLE concerts ADD COLUMN poster_image TEXT",
  "ALTER TABLE upcoming ADD COLUMN poster_image TEXT",
];

for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

// One-time cleanup: null out setlist_fm_id for concerts whose cached setlist has no songs
// This fixes festival children that were imported before the hasSongs check was added
(() => {
  const rows = db.prepare(
    "SELECT id, setlist_fm_id FROM concerts WHERE setlist_fm_id IS NOT NULL AND parent_concert_id IS NOT NULL"
  ).all();

  let cleaned = 0;
  for (const row of rows) {
    const cached = db.prepare("SELECT response FROM setlist_cache WHERE cache_key = ?").get(`setlist:${row.setlist_fm_id}`);
    if (cached) {
      try {
        const data = JSON.parse(cached.response);
        const hasSongs = data.sets?.set?.some(s => s.song?.length > 0) || false;
        if (!hasSongs) {
          db.prepare("UPDATE concerts SET setlist_fm_id = NULL, setlist_fm_url = NULL WHERE id = ?").run(row.id);
          cleaned++;
        }
      } catch { /* skip invalid cache entries */ }
    } else {
      // No cache entry means we haven't verified this setlist has songs —
      // since the old import code stored setlist_fm_id regardless, null it out
      db.prepare("UPDATE concerts SET setlist_fm_id = NULL, setlist_fm_url = NULL WHERE id = ?").run(row.id);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`[startup] Cleaned ${cleaned} festival act(s) with empty/missing setlist data`);
})();

export default db;
