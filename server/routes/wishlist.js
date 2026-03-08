import { Router } from 'express';
import db from '../db.js';

const router = Router();

const US = (n) => `($${n}::int IS NULL OR user_id = $${n} OR user_id IS NULL)`;

// List all wishlist items
router.get('/', async (req, res) => {
  const items = await db.queryRows(`
    SELECT * FROM wishlist
    WHERE ${US(1)}
    ORDER BY
      CASE priority
        WHEN 'must_see' THEN 1
        WHEN 'want_to_see' THEN 2
        WHEN 'if_cheap' THEN 3
        ELSE 4
      END ASC,
      artist ASC
  `, [req.userId]);
  res.json(items);
});

// Get single wishlist item
router.get('/:id', async (req, res) => {
  const item = await db.queryRow(
    `SELECT * FROM wishlist WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!item) return res.status(404).json({ error: 'Wishlist item not found' });
  res.json(item);
});

// Create wishlist item
router.post('/', async (req, res) => {
  const { artist, priority, max_price, notes, url } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const validPriorities = ['must_see', 'want_to_see', 'if_cheap'];
  const pri = validPriorities.includes(priority) ? priority : 'want_to_see';

  const item = await db.queryRow(
    'INSERT INTO wishlist (user_id, artist, priority, max_price, notes, url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [req.userId, artist, pri, max_price || null, notes || null, url || null]
  );

  res.status(201).json(item);
});

// Update wishlist item
router.put('/:id', async (req, res) => {
  const existing = await db.queryRow(
    `SELECT * FROM wishlist WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!existing) return res.status(404).json({ error: 'Wishlist item not found' });

  const { artist, priority, max_price, notes, url } = req.body;

  const updated = await db.queryRow(
    'UPDATE wishlist SET artist = $1, priority = $2, max_price = $3, notes = $4, url = $5 WHERE id = $6 RETURNING *',
    [
      artist ?? existing.artist,
      priority ?? existing.priority,
      max_price !== undefined ? max_price : existing.max_price,
      notes ?? existing.notes,
      url !== undefined ? (url || null) : existing.url,
      req.params.id
    ]
  );

  res.json(updated);
});

// Delete wishlist item
router.delete('/:id', async (req, res) => {
  const existing = await db.queryRow(
    `SELECT * FROM wishlist WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!existing) return res.status(404).json({ error: 'Wishlist item not found' });

  await db.query('DELETE FROM wishlist WHERE id = $1', [req.params.id]);
  res.json({ message: 'Wishlist item deleted' });
});

// Promote: move to upcoming
router.post('/:id/promote', async (req, res) => {
  const { venue, city, date, price, section, last_minute, notes: showNotes, keep_in_wishlist } = req.body;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: [item] } = await client.query(
      `SELECT * FROM wishlist WHERE id = $1 AND ${US(2)}`,
      [req.params.id, req.userId]
    );
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    const { rows: [show] } = await client.query(
      `INSERT INTO upcoming (user_id, artist, venue, city, date, price, section, last_minute, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, item.artist, venue || null, city || null, date || null, price || null, section || null, last_minute ? 1 : 0, showNotes || null]
    );

    if (!keep_in_wishlist) {
      await client.query('DELETE FROM wishlist WHERE id = $1', [req.params.id]);
    }

    await client.query('COMMIT');
    res.json(show);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

export default router;
