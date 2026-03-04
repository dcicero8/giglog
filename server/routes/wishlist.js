import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List all wishlist items
router.get('/', (req, res) => {
  const items = db.prepare(`
    SELECT * FROM wishlist
    ORDER BY
      CASE priority
        WHEN 'must_see' THEN 1
        WHEN 'want_to_see' THEN 2
        WHEN 'if_cheap' THEN 3
        ELSE 4
      END ASC,
      artist ASC
  `).all();
  res.json(items);
});

// Get single wishlist item
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Wishlist item not found' });
  res.json(item);
});

// Create wishlist item
router.post('/', (req, res) => {
  const { artist, priority, max_price, notes, url } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const validPriorities = ['must_see', 'want_to_see', 'if_cheap'];
  const pri = validPriorities.includes(priority) ? priority : 'want_to_see';

  const result = db.prepare(
    'INSERT INTO wishlist (artist, priority, max_price, notes, url) VALUES (?, ?, ?, ?, ?)'
  ).run(artist, pri, max_price || null, notes || null, url || null);

  const item = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// Update wishlist item
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Wishlist item not found' });

  const { artist, priority, max_price, notes, url } = req.body;

  db.prepare(
    'UPDATE wishlist SET artist = ?, priority = ?, max_price = ?, notes = ?, url = ? WHERE id = ?'
  ).run(
    artist ?? existing.artist,
    priority ?? existing.priority,
    max_price !== undefined ? max_price : existing.max_price,
    notes ?? existing.notes,
    url !== undefined ? (url || null) : existing.url,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete wishlist item
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Wishlist item not found' });

  db.prepare('DELETE FROM wishlist WHERE id = ?').run(req.params.id);
  res.json({ message: 'Wishlist item deleted' });
});

// Promote: move to upcoming
router.post('/:id/promote', (req, res) => {
  const { venue, city, date, price, section, last_minute, notes: showNotes, keep_in_wishlist } = req.body;

  const promote = db.transaction((id) => {
    const item = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(id);
    if (!item) throw new Error('Wishlist item not found');

    const result = db.prepare(
      'INSERT INTO upcoming (artist, venue, city, date, price, section, last_minute, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(item.artist, venue || null, city || null, date || null, price || null, section || null, last_minute ? 1 : 0, showNotes || null);

    if (!keep_in_wishlist) {
      db.prepare('DELETE FROM wishlist WHERE id = ?').run(id);
    }

    return db.prepare('SELECT * FROM upcoming WHERE id = ?').get(result.lastInsertRowid);
  });

  try {
    const show = promote(parseInt(req.params.id));
    res.json(show);
  } catch (err) {
    if (err.message === 'Wishlist item not found') return res.status(404).json({ error: 'Wishlist item not found' });
    throw err;
  }
});

export default router;
