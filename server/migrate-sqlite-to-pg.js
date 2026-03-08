/**
 * One-time migration script: SQLite → PostgreSQL
 *
 * Usage:
 *   DATABASE_URL=postgres://giglog:giglog@localhost:5432/giglog node server/migrate-sqlite-to-pg.js
 *
 * Prerequisites:
 *   - PostgreSQL running (docker-compose up -d)
 *   - giglog.db exists in project root
 *   - better-sqlite3 still in node_modules
 */

import Database from 'better-sqlite3';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'giglog.db');

if (!fs.existsSync(dbPath)) {
  console.error(`SQLite database not found at ${dbPath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sqlite = new Database(dbPath);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('Starting SQLite → PostgreSQL migration...\n');

  // Create schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema created.\n');

  // Migrate each table
  await migrateTable('concerts', [
    'artist', 'venue', 'city', 'date', 'price', 'rating', 'notes', 'last_minute',
    'setlist_fm_id', 'setlist_fm_url', 'ticket_art_svg', 'youtube_url', 'youtube_match',
    'ticket_image', 'parent_concert_id', 'display_order', 'tour_name', 'end_date',
    'poster_image', 'created_at'
  ]);

  await migrateTable('upcoming', [
    'artist', 'venue', 'city', 'date', 'price', 'section', 'last_minute', 'notes',
    'ticket_art_svg', 'ticket_image', 'poster_image', 'created_at'
  ]);

  await migrateTable('wishlist', [
    'artist', 'priority', 'max_price', 'notes', 'url', 'created_at'
  ]);

  await migrateTable('setlist_cache', [
    'cache_key', 'response', 'fetched_at', 'expires_at'
  ], 'cache_key');

  await migrateTable('seatgeek_cache', [
    'cache_key', 'response', 'fetched_at', 'expires_at'
  ], 'cache_key');

  await migrateTable('api_usage', [
    'date', 'request_count'
  ], 'date');

  await migrateTable('concert_photos', [
    'concert_id', 'filename', 'original_name', 'caption', 'created_at'
  ]);

  await migrateTable('external_links', [
    'concert_id', 'source', 'url', 'label', 'created_at'
  ]);

  await migrateTable('geocode_cache', [
    'city', 'lat', 'lon', 'fetched_at'
  ], 'city');

  await migrateTable('dismissed_artists', [
    'artist', 'dismissed_at'
  ]);

  // Reset sequences for SERIAL columns to continue after migrated data
  for (const table of ['concerts', 'upcoming', 'wishlist', 'concert_photos', 'external_links', 'dismissed_artists']) {
    try {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0))`);
    } catch (err) {
      // Table might be empty, that's fine
    }
  }

  console.log('\nMigration complete!');
  await pool.end();
  sqlite.close();
}

async function migrateTable(tableName, columns, primaryKey = 'id') {
  // Check if table has data in SQLite
  let rows;
  try {
    rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
  } catch {
    console.log(`  ${tableName}: table not found in SQLite, skipping`);
    return;
  }

  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows (empty)`);
    return;
  }

  // For tables with SERIAL id, we need to include id in the insert to preserve references
  const hasSerialId = primaryKey === 'id';
  const insertCols = hasSerialId ? ['id', ...columns] : columns;

  // Build parameterized INSERT
  const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
  const conflictCol = hasSerialId ? 'id' : primaryKey;
  const insertSql = `INSERT INTO ${tableName} (${insertCols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictCol}) DO NOTHING`;

  let migrated = 0;
  for (const row of rows) {
    const values = insertCols.map(col => {
      const val = row[col];
      // Convert SQLite datetime strings to proper timestamps
      if (val && (col.endsWith('_at') || col === 'fetched_at' || col === 'expires_at') && typeof val === 'string') {
        return val;
      }
      return val ?? null;
    });

    try {
      await pool.query(insertSql, values);
      migrated++;
    } catch (err) {
      console.error(`  ${tableName}: error migrating row ${row[primaryKey]}:`, err.message);
    }
  }

  console.log(`  ${tableName}: ${migrated}/${rows.length} rows migrated`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
