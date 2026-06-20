import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// User scope helper — shows own data only (dev mode with null userId sees everything)
const US = (n) => `($${n}::int IS NULL OR user_id = $${n})`;

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
router.get('/', async (req, res) => {
  const { sort, filter, search } = req.query;
  const uid = req.userId;

  let query = 'SELECT * FROM concerts';
  const conditions = ['parent_concert_id IS NULL', US(1)];
  const params = [uid];
  let paramIdx = 2;

  if (filter === 'last_minute') {
    conditions.push('last_minute = 1');
  }

  if (search) {
    conditions.push(`(artist ILIKE $${paramIdx} OR id IN (SELECT parent_concert_id FROM concerts WHERE artist ILIKE $${paramIdx + 1} AND parent_concert_id IS NOT NULL))`);
    params.push(`%${search}%`, `%${search}%`);
    paramIdx += 2;
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

  const concerts = await db.queryRows(query, params);

  // Attach children to festival parents
  for (const concert of concerts) {
    const children = await db.queryRows(
      'SELECT * FROM concerts WHERE parent_concert_id = $1 ORDER BY display_order ASC',
      [concert.id]
    );
    if (children.length > 0) {
      concert.children = children;
    }
  }

  res.json(concerts);
});

// Get single concert (includes children if festival parent)
router.get('/:id', async (req, res) => {
  const concert = await db.queryRow(
    `SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  const photos = await db.queryRows(
    'SELECT * FROM concert_photos WHERE concert_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  const links = await db.queryRows(
    'SELECT * FROM external_links WHERE concert_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  const children = await db.queryRows(
    'SELECT * FROM concerts WHERE parent_concert_id = $1 ORDER BY display_order ASC',
    [req.params.id]
  );

  res.json({ ...concert, photos, links, children });
});

// Create concert
router.post('/', async (req, res) => {
  const { artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, setlist_fm_url, youtube_url, youtube_match, parent_concert_id, display_order, tour_name, end_date } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const concert = await db.queryRow(
    `INSERT INTO concerts (user_id, artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, setlist_fm_url, youtube_url, youtube_match, parent_concert_id, display_order, tour_name, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [req.userId, artist, venue || null, city || null, date || null, price || null, rating || null, notes || null, last_minute ? 1 : 0, setlist_fm_id || null, setlist_fm_url || null, youtube_url || null, youtube_match || null, parent_concert_id || null, display_order || 0, tour_name || null, end_date || null]
  );

  res.status(201).json(concert);
});

// Combine existing standalone concerts into one festival (parent container + children)
router.post('/combine', async (req, res) => {
  const { name, ids } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Festival name is required' });
  if (!Array.isArray(ids) || ids.length < 2) return res.status(400).json({ error: 'Select at least 2 shows to combine' });

  // Load the selected concerts; each must belong to the user, be standalone, and not already a festival
  const rows = [];
  for (const id of ids) {
    const c = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [id, req.userId]);
    if (!c) return res.status(404).json({ error: `Concert ${id} not found` });
    if (c.parent_concert_id) return res.status(400).json({ error: 'One of the selected shows is already part of a festival' });
    const kids = await db.queryRow('SELECT COUNT(*) as count FROM concerts WHERE parent_concert_id = $1', [c.id]);
    if (Number(kids.count) > 0) return res.status(400).json({ error: 'One of the selected items is already a festival' });
    rows.push(c);
  }

  // Derive shared fields for the parent container (use the value only if all selected shows agree)
  const shared = (key) => {
    const vals = rows.map(r => r[key]).filter(Boolean);
    return vals.length && vals.every(v => v === vals[0]) ? vals[0] : null;
  };
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const venue = shared('venue');
  const city = shared('city');
  const date = shared('date') || dates[0] || null;

  // Create the festival parent (its `artist` field is the festival name; it is not counted as a show)
  const parent = await db.queryRow(
    `INSERT INTO concerts (user_id, artist, venue, city, date, parent_concert_id, display_order)
     VALUES ($1, $2, $3, $4, $5, NULL, 0) RETURNING *`,
    [req.userId, name.trim(), venue, city, date]
  );

  // Reparent the selected concerts as children, preserving all their data
  let order = 0;
  for (const c of rows) {
    await db.query('UPDATE concerts SET parent_concert_id = $1, display_order = $2 WHERE id = $3', [parent.id, order++, c.id]);
  }

  const children = await db.queryRows('SELECT * FROM concerts WHERE parent_concert_id = $1 ORDER BY display_order ASC', [parent.id]);
  res.status(201).json({ ...parent, children });
});

// Ungroup a festival — detach all its shows (they become standalone) and remove the container
router.post('/:id/ungroup', async (req, res) => {
  const parent = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!parent) return res.status(404).json({ error: 'Festival not found' });
  await db.query('UPDATE concerts SET parent_concert_id = NULL WHERE parent_concert_id = $1', [parent.id]);
  await db.query('DELETE FROM concerts WHERE id = $1', [parent.id]);
  res.json({ message: 'Festival ungrouped' });
});

// Detach a single show from its festival (keeps the show). If fewer than 2 remain, dissolve the festival.
router.post('/:id/detach', async (req, res) => {
  const child = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!child) return res.status(404).json({ error: 'Concert not found' });
  if (!child.parent_concert_id) return res.status(400).json({ error: 'Concert is not part of a festival' });
  const parentId = child.parent_concert_id;
  await db.query('UPDATE concerts SET parent_concert_id = NULL WHERE id = $1', [child.id]);
  const remaining = await db.queryRows('SELECT id FROM concerts WHERE parent_concert_id = $1', [parentId]);
  if (remaining.length < 2) {
    await db.query('UPDATE concerts SET parent_concert_id = NULL WHERE parent_concert_id = $1', [parentId]);
    await db.query('DELETE FROM concerts WHERE id = $1', [parentId]);
    return res.json({ message: 'Detached; festival dissolved', dissolved: true });
  }
  res.json({ message: 'Detached', dissolved: false });
});

// Update concert
router.put('/:id', async (req, res) => {
  const existing = await db.queryRow(
    `SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!existing) return res.status(404).json({ error: 'Concert not found' });

  const { artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, setlist_fm_url, youtube_url, youtube_match, tour_name, end_date } = req.body;

  const updated = await db.queryRow(
    `UPDATE concerts SET artist = $1, venue = $2, city = $3, date = $4, price = $5, rating = $6, notes = $7, last_minute = $8, setlist_fm_id = $9, setlist_fm_url = $10, youtube_url = $11, youtube_match = $12, tour_name = $13, end_date = $14
     WHERE id = $15 RETURNING *`,
    [
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
    ]
  );

  res.json(updated);
});

// Delete concert (cascade-deletes festival children if parent)
router.delete('/:id', async (req, res) => {
  const existing = await db.queryRow(
    `SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!existing) return res.status(404).json({ error: 'Concert not found' });

  await db.query('DELETE FROM concerts WHERE id = $1', [req.params.id]);
  res.json({ message: 'Concert deleted' });
});

// Reorder festival children
router.put('/:id/reorder', async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });

  const parent = await db.queryRow(
    `SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!parent) return res.status(404).json({ error: 'Festival not found' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        'UPDATE concerts SET display_order = $1 WHERE id = $2 AND parent_concert_id = $3',
        [i, orderedIds[i], parent.id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const children = await db.queryRows(
    'SELECT * FROM concerts WHERE parent_concert_id = $1 ORDER BY display_order ASC',
    [parent.id]
  );
  res.json(children);
});

// Upload photos
router.post('/:id/photos', upload.array('photos', 10), async (req, res) => {
  const concert = await db.queryRow(
    `SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  const photos = [];
  for (const file of req.files) {
    const photo = await db.queryRow(
      'INSERT INTO concert_photos (concert_id, filename, original_name, caption) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, file.filename, file.originalname, req.body.caption || null]
    );
    photos.push(photo);
  }

  res.status(201).json(photos);
});

// Get photos for a concert
router.get('/:id/photos', async (req, res) => {
  const photos = await db.queryRows(
    'SELECT * FROM concert_photos WHERE concert_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json(photos);
});

// Delete photo
router.delete('/:id/photos/:photoId', async (req, res) => {
  const photo = await db.queryRow(
    'SELECT * FROM concert_photos WHERE id = $1 AND concert_id = $2',
    [req.params.photoId, req.params.id]
  );
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  await db.query('DELETE FROM concert_photos WHERE id = $1', [req.params.photoId]);
  res.json({ message: 'Photo deleted' });
});

// Add external link
router.post('/:id/links', async (req, res) => {
  const concert = await db.queryRow(
    `SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`,
    [req.params.id, req.userId]
  );
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  const { source, url, label } = req.body;
  if (!source || !url) return res.status(400).json({ error: 'source and url are required' });

  const link = await db.queryRow(
    'INSERT INTO external_links (concert_id, source, url, label) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.params.id, source, url, label || null]
  );
  res.status(201).json(link);
});

// Delete external link
router.delete('/:id/links/:linkId', async (req, res) => {
  const link = await db.queryRow(
    'SELECT * FROM external_links WHERE id = $1 AND concert_id = $2',
    [req.params.linkId, req.params.id]
  );
  if (!link) return res.status(404).json({ error: 'Link not found' });

  await db.query('DELETE FROM external_links WHERE id = $1', [req.params.linkId]);
  res.json({ message: 'Link deleted' });
});

export default router;
