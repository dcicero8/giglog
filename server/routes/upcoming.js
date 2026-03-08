import { Router } from 'express';
import db from '../db.js';

const router = Router();

const US = (n) => `($${n}::int IS NULL OR user_id = $${n} OR user_id IS NULL)`;

// List all upcoming shows
router.get('/', async (req, res) => {
  const shows = await db.queryRows(
    `SELECT * FROM upcoming WHERE ${US(1)} ORDER BY date ASC`,
    [req.userId]
  );
  res.json(shows);
});

// Get single upcoming show
router.get('/:id', async (req, res) => {
  const show = await db.queryRow(
    `SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!show) return res.status(404).json({ error: 'Show not found' });
  res.json(show);
});

// Create upcoming show
router.post('/', async (req, res) => {
  const { artist, venue, city, date, price, section, last_minute, notes } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const show = await db.queryRow(
    `INSERT INTO upcoming (user_id, artist, venue, city, date, price, section, last_minute, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [req.userId, artist, venue || null, city || null, date || null, price || null, section || null, last_minute ? 1 : 0, notes || null]
  );

  res.status(201).json(show);
});

// Update upcoming show
router.put('/:id', async (req, res) => {
  const existing = await db.queryRow(
    `SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!existing) return res.status(404).json({ error: 'Show not found' });

  const { artist, venue, city, date, price, section, last_minute, notes } = req.body;

  const updated = await db.queryRow(
    `UPDATE upcoming SET artist = $1, venue = $2, city = $3, date = $4, price = $5, section = $6, last_minute = $7, notes = $8
     WHERE id = $9 RETURNING *`,
    [
      artist ?? existing.artist,
      venue ?? existing.venue,
      city ?? existing.city,
      date ?? existing.date,
      price ?? existing.price,
      section ?? existing.section,
      last_minute !== undefined ? (last_minute ? 1 : 0) : existing.last_minute,
      notes ?? existing.notes,
      req.params.id
    ]
  );

  res.json(updated);
});

// Delete upcoming show
router.delete('/:id', async (req, res) => {
  const existing = await db.queryRow(
    `SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!existing) return res.status(404).json({ error: 'Show not found' });

  await db.query('DELETE FROM upcoming WHERE id = $1', [req.params.id]);
  res.json({ message: 'Show deleted' });
});

// Complete: move to concerts
router.post('/:id/complete', async (req, res) => {
  const { rating, notes: extraNotes } = req.body;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: [show] } = await client.query(
      `SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`,
      [req.params.id, req.userId]
    );
    if (!show) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Show not found' });
    }

    const combinedNotes = [show.notes, extraNotes].filter(Boolean).join('\n');

    const { rows: [concert] } = await client.query(
      `INSERT INTO concerts (user_id, artist, venue, city, date, price, rating, notes, last_minute)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, show.artist, show.venue, show.city, show.date, show.price, rating || null, combinedNotes || null, show.last_minute]
    );

    await client.query('DELETE FROM upcoming WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');
    res.json(concert);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export default router;
