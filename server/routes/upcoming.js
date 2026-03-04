import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List all upcoming shows
router.get('/', (req, res) => {
  const shows = db.prepare('SELECT * FROM upcoming ORDER BY date ASC').all();
  res.json(shows);
});

// Get single upcoming show
router.get('/:id', (req, res) => {
  const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  res.json(show);
});

// Create upcoming show
router.post('/', (req, res) => {
  const { artist, venue, city, date, price, section, last_minute, notes } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const result = db.prepare(
    'INSERT INTO upcoming (artist, venue, city, date, price, section, last_minute, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(artist, venue || null, city || null, date || null, price || null, section || null, last_minute ? 1 : 0, notes || null);

  const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(show);
});

// Update upcoming show
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Show not found' });

  const { artist, venue, city, date, price, section, last_minute, notes } = req.body;

  db.prepare(
    'UPDATE upcoming SET artist = ?, venue = ?, city = ?, date = ?, price = ?, section = ?, last_minute = ?, notes = ? WHERE id = ?'
  ).run(
    artist ?? existing.artist,
    venue ?? existing.venue,
    city ?? existing.city,
    date ?? existing.date,
    price ?? existing.price,
    section ?? existing.section,
    last_minute !== undefined ? (last_minute ? 1 : 0) : existing.last_minute,
    notes ?? existing.notes,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete upcoming show
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Show not found' });

  db.prepare('DELETE FROM upcoming WHERE id = ?').run(req.params.id);
  res.json({ message: 'Show deleted' });
});

// Complete: move to concerts
router.post('/:id/complete', (req, res) => {
  const { rating, notes: extraNotes } = req.body;

  const moveShow = db.transaction((id) => {
    const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(id);
    if (!show) throw new Error('Show not found');

    const combinedNotes = [show.notes, extraNotes].filter(Boolean).join('\n');

    const result = db.prepare(
      'INSERT INTO concerts (artist, venue, city, date, price, rating, notes, last_minute) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(show.artist, show.venue, show.city, show.date, show.price, rating || null, combinedNotes || null, show.last_minute);

    db.prepare('DELETE FROM upcoming WHERE id = ?').run(id);

    return db.prepare('SELECT * FROM concerts WHERE id = ?').get(result.lastInsertRowid);
  });

  try {
    const concert = moveShow(parseInt(req.params.id));
    res.json(concert);
  } catch (err) {
    if (err.message === 'Show not found') return res.status(404).json({ error: 'Show not found' });
    throw err;
  }
});

export default router;
