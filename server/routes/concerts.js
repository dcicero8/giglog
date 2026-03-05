import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Photo upload config
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads', 'photos'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// List all concerts (excludes festival children — they're nested under parents)
router.get('/', (req, res) => {
  const { sort, filter, search } = req.query;

  let query = 'SELECT * FROM concerts';
  const conditions = ['parent_concert_id IS NULL'];
  const params = [];

  if (filter === 'last_minute') {
    conditions.push('last_minute = 1');
  }

  if (search) {
    conditions.push('(artist LIKE ? OR id IN (SELECT parent_concert_id FROM concerts WHERE artist LIKE ? AND parent_concert_id IS NOT NULL))');
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' WHERE ' + conditions.join(' AND ');

  switch (sort) {
    case 'date_asc': query += ' ORDER BY date ASC'; break;
    case 'price_asc': query += ' ORDER BY price ASC'; break;
    case 'price_desc': query += ' ORDER BY price DESC'; break;
    case 'rating_asc': query += ' ORDER BY rating ASC'; break;
    case 'rating_desc': query += ' ORDER BY rating DESC'; break;
    default: query += ' ORDER BY date DESC';
  }

  const concerts = db.prepare(query).all(...params);

  // Attach children to festival parents
  for (const concert of concerts) {
    const children = db.prepare('SELECT * FROM concerts WHERE parent_concert_id = ? ORDER BY display_order ASC').all(concert.id);
    if (children.length > 0) {
      concert.children = children;
    }
  }

  res.json(concerts);
});

// Get single concert (includes children if festival parent)
router.get('/:id', (req, res) => {
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  const photos = db.prepare('SELECT * FROM concert_photos WHERE concert_id = ? ORDER BY created_at DESC').all(req.params.id);
  const links = db.prepare('SELECT * FROM external_links WHERE concert_id = ? ORDER BY created_at DESC').all(req.params.id);
  const children = db.prepare('SELECT * FROM concerts WHERE parent_concert_id = ? ORDER BY display_order ASC').all(req.params.id);

  res.json({ ...concert, photos, links, children });
});

// Create concert
router.post('/', (req, res) => {
  const { artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, setlist_fm_url, youtube_url, youtube_match, parent_concert_id, display_order, tour_name, end_date } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const result = db.prepare(
    'INSERT INTO concerts (artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, setlist_fm_url, youtube_url, youtube_match, parent_concert_id, display_order, tour_name, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(artist, venue || null, city || null, date || null, price || null, rating || null, notes || null, last_minute ? 1 : 0, setlist_fm_id || null, setlist_fm_url || null, youtube_url || null, youtube_match || null, parent_concert_id || null, display_order || 0, tour_name || null, end_date || null);

  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(concert);
});

// Update concert
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Concert not found' });

  const { artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, setlist_fm_url, youtube_url, youtube_match, tour_name, end_date } = req.body;

  db.prepare(
    'UPDATE concerts SET artist = ?, venue = ?, city = ?, date = ?, price = ?, rating = ?, notes = ?, last_minute = ?, setlist_fm_id = ?, setlist_fm_url = ?, youtube_url = ?, youtube_match = ?, tour_name = ?, end_date = ? WHERE id = ?'
  ).run(
    artist ?? existing.artist,
    venue ?? existing.venue,
    city ?? existing.city,
    date ?? existing.date,
    price ?? existing.price,
    rating ?? existing.rating,
    notes ?? existing.notes,
    last_minute !== undefined ? (last_minute ? 1 : 0) : existing.last_minute,
    setlist_fm_id ?? existing.setlist_fm_id,
    setlist_fm_url ?? existing.setlist_fm_url,
    youtube_url !== undefined ? (youtube_url || null) : existing.youtube_url,
    youtube_match !== undefined ? (youtube_match || null) : existing.youtube_match,
    tour_name !== undefined ? (tour_name || null) : existing.tour_name,
    end_date !== undefined ? (end_date || null) : existing.end_date,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete concert (cascade-deletes festival children if parent)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Concert not found' });

  const deleteAll = db.transaction(() => {
    // Delete children if this is a festival parent
    db.prepare('DELETE FROM concerts WHERE parent_concert_id = ?').run(req.params.id);
    db.prepare('DELETE FROM concerts WHERE id = ?').run(req.params.id);
  });
  deleteAll();
  res.json({ message: 'Concert deleted' });
});

// Reorder festival children
router.put('/:id/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });

  const parent = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!parent) return res.status(404).json({ error: 'Festival not found' });

  const reorder = db.transaction(() => {
    const stmt = db.prepare('UPDATE concerts SET display_order = ? WHERE id = ? AND parent_concert_id = ?');
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, orderedIds[i], parent.id);
    }
  });
  reorder();

  const children = db.prepare('SELECT * FROM concerts WHERE parent_concert_id = ? ORDER BY display_order ASC').all(parent.id);
  res.json(children);
});

// Upload photos
router.post('/:id/photos', upload.array('photos', 10), (req, res) => {
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  const stmt = db.prepare('INSERT INTO concert_photos (concert_id, filename, original_name, caption) VALUES (?, ?, ?, ?)');
  const photos = [];

  for (const file of req.files) {
    const result = stmt.run(req.params.id, file.filename, file.originalname, req.body.caption || null);
    photos.push({ id: result.lastInsertRowid, filename: file.filename, original_name: file.originalname });
  }

  res.status(201).json(photos);
});

// Get photos for a concert
router.get('/:id/photos', (req, res) => {
  const photos = db.prepare('SELECT * FROM concert_photos WHERE concert_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(photos);
});

// Delete photo
router.delete('/:id/photos/:photoId', (req, res) => {
  const photo = db.prepare('SELECT * FROM concert_photos WHERE id = ? AND concert_id = ?').get(req.params.photoId, req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  db.prepare('DELETE FROM concert_photos WHERE id = ?').run(req.params.photoId);
  res.json({ message: 'Photo deleted' });
});

// Add external link
router.post('/:id/links', (req, res) => {
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  const { source, url, label } = req.body;
  if (!source || !url) return res.status(400).json({ error: 'source and url are required' });

  const result = db.prepare('INSERT INTO external_links (concert_id, source, url, label) VALUES (?, ?, ?, ?)').run(req.params.id, source, url, label || null);
  const link = db.prepare('SELECT * FROM external_links WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(link);
});

// Delete external link
router.delete('/:id/links/:linkId', (req, res) => {
  const link = db.prepare('SELECT * FROM external_links WHERE id = ? AND concert_id = ?').get(req.params.linkId, req.params.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  db.prepare('DELETE FROM external_links WHERE id = ?').run(req.params.linkId);
  res.json({ message: 'Link deleted' });
});

export default router;
