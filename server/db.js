import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// better-sqlite3 is optional (native addon may not compile on all platforms)
let Database;
try {
  Database = (await import('better-sqlite3')).default;
} catch {
  Database = null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mode = 'pg'; // 'pg' or 'sqlite'
let pool = null;
let sqliteDb = null;

// ── SQLite adapter: translates Postgres-style queries to SQLite ──
// Translate Postgres SQL to SQLite and expand params for repeated $N references
function pgToSqlite(text, params) {
  let q = text;
  // ::int, ::text casts → remove (before $N replacement so $1::int becomes $1)
  q = q.replace(/::\w+/g, '');
  // NOW() → datetime('now')
  q = q.replace(/\bNOW\(\)/gi, "datetime('now')");
  // SERIAL → INTEGER (for CREATE TABLE)
  q = q.replace(/\bSERIAL\b/gi, 'INTEGER');
  // TIMESTAMPTZ → TEXT
  q = q.replace(/\bTIMESTAMPTZ\b/gi, 'TEXT');
  // RETURNING * → remove (handled via lastInsertRowid)
  q = q.replace(/\s+RETURNING\s+\*/gi, '');
  // COLLATE "default" → remove
  q = q.replace(/COLLATE\s+"default"/gi, '');
  // TIMESTAMP(6) → TEXT
  q = q.replace(/TIMESTAMP\(\d+\)/gi, 'TEXT');

  // Expand $N references → ? and build expanded params array
  // In Postgres $1 can appear multiple times; in SQLite each ? is a separate positional param
  const expandedParams = [];
  q = q.replace(/\$(\d+)/g, (_, numStr) => {
    const idx = parseInt(numStr) - 1; // $1 → index 0
    if (params && idx < params.length) {
      expandedParams.push(params[idx]);
    } else {
      expandedParams.push(null);
    }
    return '?';
  });

  return { sql: q, params: expandedParams };
}

function flattenParams(params) {
  if (!params) return [];
  return params.map(p => (p === null || p === undefined) ? null : p);
}

// SQLite wrapper that mimics pg interface
const sqliteAdapter = {
  async query(text, params) {
    const { sql: q, params: p } = pgToSqlite(text, flattenParams(params));
    const trimmed = q.trim().toUpperCase();
    try {
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
        const rows = sqliteDb.prepare(q).all(...p);
        return { rows, rowCount: rows.length };
      } else if (trimmed.startsWith('INSERT')) {
        const info = sqliteDb.prepare(q).run(...p);
        const table = q.match(/INSERT\s+INTO\s+["']?(\w+)["']?/i)?.[1];
        if (table && info.lastInsertRowid) {
          const row = sqliteDb.prepare(`SELECT * FROM "${table}" WHERE rowid = ?`).get(info.lastInsertRowid);
          return { rows: row ? [row] : [], rowCount: info.changes };
        }
        return { rows: [], rowCount: info.changes };
      } else {
        const info = sqliteDb.prepare(q).run(...p);
        return { rows: [], rowCount: info.changes };
      }
    } catch (err) {
      if (q.includes('CREATE TABLE') || q.includes('CREATE INDEX')) {
        try { sqliteDb.exec(q); return { rows: [], rowCount: 0 }; } catch { /* ignore */ }
      }
      throw err;
    }
  },

  async queryRow(text, params) {
    const { sql: q, params: p } = pgToSqlite(text, flattenParams(params));
    const trimmed = q.trim().toUpperCase();
    try {
      if (trimmed.startsWith('INSERT')) {
        const info = sqliteDb.prepare(q).run(...p);
        const table = q.match(/INSERT\s+INTO\s+["']?(\w+)["']?/i)?.[1];
        if (table && info.lastInsertRowid) {
          return sqliteDb.prepare(`SELECT * FROM "${table}" WHERE rowid = ?`).get(info.lastInsertRowid) || null;
        }
        return null;
      }
      return sqliteDb.prepare(q).get(...p) || null;
    } catch (err) {
      throw err;
    }
  },

  async queryRows(text, params) {
    const { sql: q, params: p } = pgToSqlite(text, flattenParams(params));
    try {
      return sqliteDb.prepare(q).all(...p);
    } catch (err) {
      throw err;
    }
  },

  async getClient() {
    return {
      async query(text, params) {
        return sqliteAdapter.query(text, params);
      },
      release() { /* no-op */ },
    };
  },

  pool: null,
};

// ── Postgres adapter ──
const pgAdapter = {
  async query(text, params) {
    return pool.query(text, params);
  },

  async queryRow(text, params) {
    const { rows } = await pool.query(text, params);
    return rows[0] || null;
  },

  async queryRows(text, params) {
    const { rows } = await pool.query(text, params);
    return rows;
  },

  async getClient() {
    return pool.connect();
  },

  get pool() { return pool; },
};

// ── Initialization ──
async function initPostgres() {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  client.release();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  return pgAdapter;
}

function initSQLite() {
  if (!Database) throw new Error('better-sqlite3 not available');
  const dbPath = path.join(__dirname, '..', 'data', 'giglog.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS concerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      artist TEXT NOT NULL, venue TEXT, city TEXT, date TEXT, price REAL, rating INTEGER,
      notes TEXT, last_minute INTEGER DEFAULT 0, setlist_fm_id TEXT, setlist_fm_url TEXT,
      ticket_art_svg TEXT, youtube_url TEXT, youtube_match TEXT, ticket_image TEXT,
      parent_concert_id INTEGER REFERENCES concerts(id) ON DELETE CASCADE,
      display_order INTEGER DEFAULT 0, tour_name TEXT, end_date TEXT, poster_image TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS upcoming (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      artist TEXT NOT NULL, venue TEXT, city TEXT, date TEXT, price REAL, section TEXT,
      last_minute INTEGER DEFAULT 0, notes TEXT, ticket_art_svg TEXT,
      ticket_image TEXT, poster_image TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      artist TEXT NOT NULL, priority TEXT DEFAULT 'want_to_see',
      max_price REAL, notes TEXT, url TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS setlist_cache (
      cache_key TEXT PRIMARY KEY, response TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seatgeek_cache (
      cache_key TEXT PRIMARY KEY, response TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_usage (date TEXT PRIMARY KEY, request_count INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS concert_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concert_id INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
      filename TEXT NOT NULL, original_name TEXT, caption TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS external_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concert_id INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
      source TEXT NOT NULL, url TEXT NOT NULL, label TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS geocode_cache (
      city TEXT PRIMARY KEY, lat REAL NOT NULL, lon REAL NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS dismissed_artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT, artist TEXT NOT NULL, user_id INTEGER,
      dismissed_at TEXT DEFAULT (datetime('now')), UNIQUE(artist, user_id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS buddy_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT UNIQUE NOT NULL, accepted_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')), accepted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS buddies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buddy_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, buddy_id)
    );
  `);

  return sqliteAdapter;
}

// ── The db proxy (delegates to whichever adapter is active) ──
let _adapter = null;

async function getAdapter() {
  if (_adapter) return _adapter;

  if (process.env.DATABASE_URL) {
    try {
      _adapter = await initPostgres();
      mode = 'pg';
      console.log('[db] Connected to PostgreSQL');
      return _adapter;
    } catch (err) {
      console.warn(`[db] PostgreSQL connection failed (${err.code || err.message}), falling back to SQLite`);
    }
  }

  _adapter = initSQLite();
  mode = 'sqlite';
  console.log('[db] Using SQLite (local development mode)');
  return _adapter;
}

// ── Auto-migration: SQLite → Postgres (runs once on first deploy) ──
async function autoMigrateFromSQLite() {
  // Check if Postgres already has data (skip if so)
  const pgCount = (await pool.query("SELECT COUNT(*) as count FROM concerts")).rows[0].count;
  if (parseInt(pgCount) > 0) {
    console.log('[migration] Postgres already has data, skipping auto-migration');
    return;
  }

  // Look for SQLite file in known locations
  const candidates = [
    path.join(__dirname, '..', 'data', 'giglog.db'),   // local dev + Railway persistent volume
    '/app/data/giglog.db',                               // Railway absolute path
    path.join(__dirname, '..', 'giglog.db'),              // old project root location
  ];

  let sqlitePath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      sqlitePath = p;
      break;
    }
  }

  if (!sqlitePath) {
    console.log('[migration] No SQLite database found, starting fresh');
    return;
  }

  if (!Database) {
    console.log('[migration] SQLite found but better-sqlite3 not available, skipping auto-migration');
    return;
  }

  console.log(`[migration] Found SQLite at ${sqlitePath}, starting auto-migration to Postgres...`);
  const sqlite = new Database(sqlitePath, { readonly: true });

  const tables = [
    { name: 'concerts', columns: ['artist', 'venue', 'city', 'date', 'price', 'rating', 'notes', 'last_minute', 'setlist_fm_id', 'setlist_fm_url', 'ticket_art_svg', 'youtube_url', 'youtube_match', 'ticket_image', 'parent_concert_id', 'display_order', 'tour_name', 'end_date', 'poster_image', 'created_at', 'user_id'], pk: 'id' },
    { name: 'upcoming', columns: ['artist', 'venue', 'city', 'date', 'price', 'section', 'last_minute', 'notes', 'ticket_art_svg', 'ticket_image', 'poster_image', 'created_at', 'user_id'], pk: 'id' },
    { name: 'wishlist', columns: ['artist', 'priority', 'max_price', 'notes', 'url', 'created_at', 'user_id'], pk: 'id' },
    { name: 'setlist_cache', columns: ['cache_key', 'response', 'fetched_at', 'expires_at'], pk: 'cache_key' },
    { name: 'seatgeek_cache', columns: ['cache_key', 'response', 'fetched_at', 'expires_at'], pk: 'cache_key' },
    { name: 'api_usage', columns: ['date', 'request_count'], pk: 'date' },
    { name: 'concert_photos', columns: ['concert_id', 'filename', 'original_name', 'caption', 'created_at'], pk: 'id' },
    { name: 'external_links', columns: ['concert_id', 'source', 'url', 'label', 'created_at'], pk: 'id' },
    { name: 'geocode_cache', columns: ['city', 'lat', 'lon', 'fetched_at'], pk: 'city' },
    { name: 'dismissed_artists', columns: ['artist', 'user_id', 'dismissed_at'], pk: 'id' },
  ];

  let totalMigrated = 0;

  for (const { name, columns, pk } of tables) {
    let rows;
    try {
      rows = sqlite.prepare(`SELECT * FROM ${name}`).all();
    } catch {
      console.log(`  ${name}: table not found in SQLite, skipping`);
      continue;
    }

    if (rows.length === 0) {
      console.log(`  ${name}: 0 rows (empty)`);
      continue;
    }

    const hasSerialId = pk === 'id';
    const insertCols = hasSerialId ? ['id', ...columns] : columns;

    // Filter to only columns that actually exist in this SQLite table
    const sampleRow = rows[0];
    const validCols = insertCols.filter(col => col in sampleRow);

    const placeholders = validCols.map((_, i) => `$${i + 1}`).join(', ');
    const conflictCol = hasSerialId ? 'id' : pk;
    const insertSql = `INSERT INTO ${name} (${validCols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictCol}) DO NOTHING`;

    let migrated = 0;
    for (const row of rows) {
      const values = validCols.map(col => row[col] ?? null);
      try {
        await pool.query(insertSql, values);
        migrated++;
      } catch (err) {
        console.error(`  ${name}: error migrating row ${row[pk]}:`, err.message);
      }
    }

    console.log(`  ${name}: ${migrated}/${rows.length} rows migrated`);
    totalMigrated += migrated;
  }

  // Reset SERIAL sequences so new inserts get correct IDs
  for (const table of ['concerts', 'upcoming', 'wishlist', 'concert_photos', 'external_links', 'dismissed_artists']) {
    try {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0))`);
    } catch { /* table might be empty */ }
  }

  sqlite.close();
  console.log(`[migration] Auto-migration complete! ${totalMigrated} total rows migrated.`);
}

const db = {
  async query(...args) { return (await getAdapter()).query(...args); },
  async queryRow(...args) { return (await getAdapter()).queryRow(...args); },
  async queryRows(...args) { return (await getAdapter()).queryRows(...args); },
  async getClient(...args) { return (await getAdapter()).getClient(...args); },
  get pool() { return pool; },

  async init() {
    await getAdapter(); // ensures adapter is initialized

    // ── Auto-migrate SQLite → Postgres if Postgres is empty but SQLite has data ──
    if (mode === 'pg') {
      await autoMigrateFromSQLite();
    }

    // Cleanup festival acts with empty/missing setlist data
    const rows = await db.queryRows(
      "SELECT id, setlist_fm_id FROM concerts WHERE setlist_fm_id IS NOT NULL AND parent_concert_id IS NOT NULL"
    );

    let cleaned = 0;
    for (const row of rows) {
      const cached = await db.queryRow(
        "SELECT response FROM setlist_cache WHERE cache_key = $1",
        [`setlist:${row.setlist_fm_id}`]
      );

      if (cached) {
        try {
          const data = JSON.parse(cached.response);
          const hasSongs = data.sets?.set?.some(s => s.song?.length > 0) || false;
          if (!hasSongs) {
            await db.query("UPDATE concerts SET setlist_fm_id = NULL, setlist_fm_url = NULL WHERE id = $1", [row.id]);
            cleaned++;
          }
        } catch { /* skip invalid cache entries */ }
      } else {
        await db.query("UPDATE concerts SET setlist_fm_id = NULL, setlist_fm_url = NULL WHERE id = $1", [row.id]);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[startup] Cleaned ${cleaned} festival act(s) with empty/missing setlist data`);
  }
};

export default db;
