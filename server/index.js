import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import db from './db.js';
import { setupAuth } from './auth.js';
import requireAuth from './middleware/requireAuth.js';
import concertsRouter from './routes/concerts.js';
import upcomingRouter from './routes/upcoming.js';
import wishlistRouter from './routes/wishlist.js';
import setlistfmRouter from './routes/setlistfm.js';
import songsRouter from './routes/songs.js';
import buddiesRouter from './routes/buddies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;

// Trust Railway/Render reverse proxy (needed for secure cookies over HTTPS)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Session middleware — PgStore gets set up after db.init() connects
// (placeholder — real store attached in startup block below)
let sessionMiddleware;
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'giglog-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
  },
};
// Use a lazy session middleware that waits for db to initialize
app.use((req, res, next) => {
  if (!sessionMiddleware) {
    // db hasn't initialized yet, skip session
    return next();
  }
  sessionMiddleware(req, res, next);
});

// Auth setup (Google OAuth or unauthenticated mode)
setupAuth(app);

// In production, store uploads on persistent volume
const uploadsBase = process.env.NODE_ENV === 'production' && fs.existsSync('/app/data')
  ? '/app/data/uploads'
  : path.join(__dirname, '..', 'uploads');
const ticketsDir = path.join(uploadsBase, 'tickets');
const postersDir = path.join(uploadsBase, 'posters');
if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir, { recursive: true });
if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true });

// Multer config for ticket images
const ticketStorage = multer.diskStorage({
  destination: ticketsDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const ticketUpload = multer({ storage: ticketStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// Multer config for poster images
const posterStorage = multer.diskStorage({
  destination: postersDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const posterUpload = multer({ storage: posterStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// Serve uploaded files (photos + tickets)
app.use('/uploads', express.static(uploadsBase));

// Apply auth middleware to all API routes
app.use('/api', requireAuth);

// API routes
app.use('/api/concerts', concertsRouter);
app.use('/api/upcoming', upcomingRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/setlistfm', setlistfmRouter);
app.use('/api/songs', songsRouter);
app.use('/api/buddies', buddiesRouter);

// User scope helper — shows own data only (dev mode with null userId sees everything)
const US = (n) => `($${n}::int IS NULL OR user_id = $${n})`;

// Stats endpoint for dashboard
// Count children (individual bands) as shows, but not festival parents themselves
app.get('/api/stats', async (req, res) => {
  const uid = req.userId;
  const childCount = (await db.queryRow(`SELECT COUNT(*) as count FROM concerts WHERE parent_concert_id IS NOT NULL AND ${US(1)}`, [uid])).count;
  const soloCount = (await db.queryRow(`SELECT COUNT(*) as count FROM concerts WHERE parent_concert_id IS NULL AND ${US(1)} AND id NOT IN (SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL)`, [uid])).count;
  const concertCount = parseInt(soloCount) + parseInt(childCount);
  const upcomingCount = (await db.queryRow(`SELECT COUNT(*) as count FROM upcoming WHERE ${US(1)}`, [uid])).count;
  const wishlistCount = (await db.queryRow(`SELECT COUNT(*) as count FROM wishlist WHERE ${US(1)}`, [uid])).count;
  const totalSpent = (await db.queryRow(`SELECT COALESCE(SUM(price), 0) as total FROM concerts WHERE ${US(1)}`, [uid])).total;
  const upcomingSpent = (await db.queryRow(`SELECT COALESCE(SUM(price), 0) as total FROM upcoming WHERE ${US(1)}`, [uid])).total;
  const avgPrice = (await db.queryRow(`SELECT COALESCE(AVG(price), 0) as avg FROM concerts WHERE price IS NOT NULL AND price > 0 AND ${US(1)}`, [uid])).avg;
  const avgLastMinutePrice = (await db.queryRow(`SELECT COALESCE(AVG(price), 0) as avg FROM concerts WHERE last_minute = 1 AND price IS NOT NULL AND price > 0 AND ${US(1)}`, [uid])).avg;

  res.json({
    concertCount,
    upcomingCount: parseInt(upcomingCount),
    wishlistCount: parseInt(wishlistCount),
    totalSpent: parseFloat(totalSpent) + parseFloat(upcomingSpent),
    avgPrice: Math.round(parseFloat(avgPrice) * 100) / 100,
    avgLastMinutePrice: Math.round(parseFloat(avgLastMinutePrice) * 100) / 100,
  });
});

// Artists aggregate endpoint
app.get('/api/artists', async (req, res) => {
  const uid = req.userId;
  // Exclude festival parent entries (they're containers like "Lollapalooza", not real artists)
  // A festival parent is a concert that has children pointing to it
  const artists = await db.queryRows(`
    SELECT artist, 'concert' as source, date, price, rating FROM concerts
      WHERE id NOT IN (SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL)
      AND ${US(1)}
    UNION ALL
    SELECT artist, 'upcoming' as source, date, price, NULL as rating FROM upcoming WHERE ${US(1)}
    UNION ALL
    SELECT artist, 'wishlist' as source, NULL as date, NULL as price, NULL as rating FROM wishlist WHERE ${US(1)}
  `, [uid]);

  const map = {};
  for (const row of artists) {
    if (!map[row.artist]) {
      map[row.artist] = { artist: row.artist, showCount: 0, upcomingCount: 0, wishlist: false, totalSpent: 0, ratings: [], dates: [] };
    }
    const entry = map[row.artist];
    if (row.source === 'concert') {
      entry.showCount++;
      if (row.price) entry.totalSpent += parseFloat(row.price);
      if (row.rating) entry.ratings.push(row.rating);
      if (row.date) entry.dates.push(row.date);
    } else if (row.source === 'upcoming') {
      entry.upcomingCount++;
      if (row.date) entry.dates.push(row.date);
    } else {
      entry.wishlist = true;
    }
  }

  const result = Object.values(map).map(a => ({
    artist: a.artist,
    showCount: a.showCount,
    upcomingCount: a.upcomingCount,
    wishlist: a.wishlist,
    totalSpent: Math.round(a.totalSpent * 100) / 100,
    avgRating: a.ratings.length ? Math.round((a.ratings.reduce((s, r) => s + r, 0) / a.ratings.length) * 10) / 10 : null,
    firstSeen: a.dates.length ? a.dates.sort()[0] : null,
    lastSeen: a.dates.length ? a.dates.sort().pop() : null,
  })).sort((a, b) => a.artist.localeCompare(b.artist));

  res.json(result);
});

// Geocode endpoint
app.get('/api/geocode', async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'city is required' });

  const cached = await db.queryRow('SELECT lat, lon FROM geocode_cache WHERE city = $1', [city]);
  if (cached) return res.json(cached);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`,
      { headers: { 'User-Agent': 'GigLog/1.0' } }
    );
    const data = await response.json();
    if (data.length === 0) return res.status(404).json({ error: 'Location not found' });

    const { lat, lon } = data[0];
    await db.query(
      'INSERT INTO geocode_cache (city, lat, lon) VALUES ($1, $2, $3) ON CONFLICT (city) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon',
      [city, parseFloat(lat), parseFloat(lon)]
    );
    res.json({ lat: parseFloat(lat), lon: parseFloat(lon) });
  } catch (err) {
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// SeatGeek API proxy (CORS not supported by SeatGeek, so we proxy through server)
app.get('/api/seatgeek/status', (req, res) => {
  res.json({ available: !!process.env.SEATGEEK_CLIENT_ID });
});

app.get('/api/seatgeek/events', async (req, res) => {
  if (!process.env.SEATGEEK_CLIENT_ID) return res.status(400).json({ error: 'SEATGEEK_CLIENT_ID not configured' });

  const cacheKey = 'seatgeek_la_concerts_60d_v4';
  const cached = await db.queryRow('SELECT response, expires_at FROM seatgeek_cache WHERE cache_key = $1', [cacheKey]);
  if (cached && new Date(cached.expires_at) > new Date()) {
    return res.json(JSON.parse(cached.response));
  }

  const mapEvent = (e) => ({
    id: e.id,
    title: e.short_title || e.title,
    artist: e.performers?.[0]?.name || e.title,
    venue: e.venue?.name || '',
    city: e.venue?.city || '',
    state: e.venue?.state || '',
    date: e.datetime_local ? e.datetime_local.split('T')[0] : null,
    time: e.datetime_local ? e.datetime_local.split('T')[1]?.slice(0, 5) : null,
    url: e.url,
    image: e.performers?.[0]?.image || null,
    lowest_price: e.stats?.lowest_price || null,
    average_price: e.stats?.average_price || null,
    listing_count: e.stats?.listing_count || 0,
  });

  try {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const baseParams = {
      'lat': '34.0522',
      'lon': '-118.2437',
      'range': '30mi',
      'taxonomies.name': 'concert',
      'datetime_local.gte': today,
      'datetime_local.lte': future,
      'sort': 'datetime_local.asc',
      'client_id': process.env.SEATGEEK_CLIENT_ID,
      ...(process.env.SEATGEEK_CLIENT_SECRET ? { 'client_secret': process.env.SEATGEEK_CLIENT_SECRET } : {}),
    };

    // 1. General LA events feed (discovery)
    const generalParams = new URLSearchParams({ ...baseParams, 'per_page': '200' });
    const generalRes = await fetch(`https://api.seatgeek.com/2/events?${generalParams}`);
    if (!generalRes.ok) throw new Error(`SeatGeek API returned ${generalRes.status}`);
    const generalData = await generalRes.json();
    const generalEvents = (generalData.events || []).map(mapEvent);

    // 2. Targeted searches for wishlist + past concert artists (guarantees they appear)
    const uid = req.userId;
    const wishlistArtists = await db.queryRows(`SELECT artist FROM wishlist WHERE ${US(1)}`, [uid]);
    const pastArtists = await db.queryRows(
      `SELECT DISTINCT artist FROM concerts
       WHERE id NOT IN (SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL)
       AND ${US(1)}`,
      [uid]
    );

    // Deduplicate: build a unique set of artist names to search
    const searchedNames = new Set();
    const artistsToSearch = [];
    for (const { artist } of [...wishlistArtists, ...pastArtists]) {
      const key = artist.toLowerCase().trim();
      if (!searchedNames.has(key)) {
        searchedNames.add(key);
        artistsToSearch.push(artist);
      }
    }

    const seenIds = new Set(generalEvents.map(e => e.id));
    const targetedEvents = [];

    for (const artist of artistsToSearch) {
      try {
        const artistParams = new URLSearchParams({ ...baseParams, 'per_page': '10', 'q': artist });
        const artistRes = await fetch(`https://api.seatgeek.com/2/events?${artistParams}`);
        if (artistRes.ok) {
          const artistData = await artistRes.json();
          for (const e of (artistData.events || [])) {
            if (!seenIds.has(e.id)) {
              seenIds.add(e.id);
              targetedEvents.push(mapEvent(e));
            }
          }
        }
      } catch (err) {
        console.error(`SeatGeek targeted search failed for "${artist}":`, err.message);
      }
    }

    console.log(`SeatGeek: ${generalEvents.length} general + ${targetedEvents.length} targeted (${artistsToSearch.length} artists searched: ${wishlistArtists.length} wishlist + ${pastArtists.length} past)`);

    // Combine and sort by date
    const events = [...generalEvents, ...targetedEvents].sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );

    // Cache for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.query(
      'INSERT INTO seatgeek_cache (cache_key, response, expires_at) VALUES ($1, $2, $3) ON CONFLICT (cache_key) DO UPDATE SET response = EXCLUDED.response, fetched_at = NOW(), expires_at = EXCLUDED.expires_at',
      [cacheKey, JSON.stringify(events), expiresAt]
    );

    res.json(events);
  } catch (err) {
    console.error('SeatGeek fetch error:', err);
    if (cached) return res.json(JSON.parse(cached.response));
    res.status(500).json({ error: 'Failed to fetch events: ' + err.message });
  }
});

// Dismissed artists (hide from On Deck)
app.get('/api/dismissed-artists', async (req, res) => {
  const rows = await db.queryRows(`SELECT artist FROM dismissed_artists WHERE ${US(1)} ORDER BY dismissed_at DESC`, [req.userId]);
  res.json(rows.map(r => r.artist));
});

app.post('/api/dismissed-artists', async (req, res) => {
  const { artist } = req.body;
  if (!artist) return res.status(400).json({ error: 'Artist name required' });
  await db.query(
    'INSERT INTO dismissed_artists (user_id, artist) VALUES ($1, $2) ON CONFLICT (user_id, artist) DO NOTHING',
    [req.userId, artist]
  );
  const rows = await db.queryRows(`SELECT artist FROM dismissed_artists WHERE ${US(1)} ORDER BY dismissed_at DESC`, [req.userId]);
  res.json(rows.map(r => r.artist));
});

app.delete('/api/dismissed-artists/:artist', async (req, res) => {
  await db.query(`DELETE FROM dismissed_artists WHERE artist = $1 AND ${US(2)}`, [decodeURIComponent(req.params.artist), req.userId]);
  const rows = await db.queryRows(`SELECT artist FROM dismissed_artists WHERE ${US(1)} ORDER BY dismissed_at DESC`, [req.userId]);
  res.json(rows.map(r => r.artist));
});

// Parse ticket image with Gemini Vision
app.post('/api/parse-ticket', ticketUpload.single('ticket'), async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY not configured' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
              {
                text: `Analyze this concert ticket image and extract the following information. Return ONLY a JSON object with these fields (use null for any field you can't determine):

{
  "artist": "performer/band name",
  "venue": "venue name",
  "city": "city, state",
  "date": "YYYY-MM-DD format",
  "price": numeric price or null,
  "section": "section, row, seat info or null",
  "notes": "any other notable info from the ticket"
}

Return ONLY the JSON, no markdown, no explanation.`,
              },
            ],
          }],
          generationConfig: { maxOutputTokens: 1000 },
        }),
      }
    );

    if (response.status === 429) {
      throw new Error('Gemini API quota exceeded — the free tier limit resets daily. Try again tomorrow or upgrade your Gemini API plan.');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || '';
      if (msg.includes('quota') || msg.includes('exceeded') || msg.includes('rate')) {
        throw new Error('Gemini API quota exceeded — the free tier limit resets daily. Try again tomorrow or upgrade your Gemini API plan.');
      }
      throw new Error(msg || `Gemini API returned ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize the date to YYYY-MM-DD
    let normalizedDate = '';
    if (parsed.date) {
      const d = new Date(parsed.date);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1950) {
        normalizedDate = d.toISOString().split('T')[0];
      } else {
        // Try parsing common formats like "Aug 14, 1992" or "03/28/2026"
        const retry = new Date(String(parsed.date).replace(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/, (_, m, d, y) => {
          const fullYear = y.length === 2 ? (parseInt(y) > 50 ? '19' + y : '20' + y) : y;
          return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }));
        if (!isNaN(retry.getTime()) && retry.getFullYear() >= 1950) {
          normalizedDate = retry.toISOString().split('T')[0];
        }
      }
    }

    // Clean up the temp file
    fs.unlinkSync(req.file.path);

    res.json({
      artist: parsed.artist || '',
      venue: parsed.venue || '',
      city: parsed.city || '',
      date: normalizedDate,
      price: parsed.price || '',
      section: parsed.section || '',
      notes: parsed.notes || '',
    });
  } catch (err) {
    // Clean up temp file on error
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Ticket parse error:', err);
    res.status(500).json({ error: 'Failed to parse ticket: ' + err.message });
  }
});

// Distinct artist names from past concerts (for On Deck "Seen Before" matching)
app.get('/api/past-artists', async (req, res) => {
  const rows = await db.queryRows(
    `SELECT DISTINCT artist FROM concerts
     WHERE id NOT IN (SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL)
     AND ${US(1)}`,
    [req.userId]
  );
  res.json(rows.map(r => r.artist));
});

// Ticket art generation (programmatic SVG — no AI needed)
const TICKET_STYLES = ['blue', 'gold', 'red', 'green', 'purple', 'teal', 'random'];

app.post('/api/concerts/:id/generate-ticket', async (req, res) => {
  const concert = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });
  const style = TICKET_STYLES.includes(req.body.style) ? req.body.style : 'blue';
  try {
    const svg = generateTicketArt(concert, style);
    await db.query('UPDATE concerts SET ticket_art_svg = $1 WHERE id = $2', [svg, concert.id]);
    res.json({ ticket_art_svg: svg });
  } catch (err) {
    res.status(500).json({ error: 'Generation failed: ' + err.message });
  }
});

app.post('/api/upcoming/:id/generate-ticket', async (req, res) => {
  const show = await db.queryRow(`SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  const style = TICKET_STYLES.includes(req.body.style) ? req.body.style : 'blue';
  try {
    const svg = generateTicketArt(show, style);
    await db.query('UPDATE upcoming SET ticket_art_svg = $1 WHERE id = $2', [svg, show.id]);
    res.json({ ticket_art_svg: svg });
  } catch (err) {
    res.status(500).json({ error: 'Generation failed: ' + err.message });
  }
});

app.get('/api/ai-status', (req, res) => {
  res.json({ available: !!process.env.GEMINI_API_KEY });
});

// Ticket image upload (concerts)
app.post('/api/concerts/:id/ticket-image', ticketUpload.single('ticket'), async (req, res) => {
  const concert = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Remove old ticket image if exists
  if (concert.ticket_image) {
    const oldPath = path.join(ticketsDir, concert.ticket_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  await db.query('UPDATE concerts SET ticket_image = $1 WHERE id = $2', [req.file.filename, concert.id]);
  res.json({ ticket_image: req.file.filename });
});

// Delete ticket image (concerts)
app.delete('/api/concerts/:id/ticket-image', async (req, res) => {
  const concert = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  if (concert.ticket_image) {
    const filePath = path.join(ticketsDir, concert.ticket_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.query('UPDATE concerts SET ticket_image = NULL WHERE id = $1', [concert.id]);
  res.json({ success: true });
});

// Ticket image upload (upcoming)
app.post('/api/upcoming/:id/ticket-image', ticketUpload.single('ticket'), async (req, res) => {
  const show = await db.queryRow(`SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  if (show.ticket_image) {
    const oldPath = path.join(ticketsDir, show.ticket_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  await db.query('UPDATE upcoming SET ticket_image = $1 WHERE id = $2', [req.file.filename, show.id]);
  res.json({ ticket_image: req.file.filename });
});

// Delete ticket image (upcoming)
app.delete('/api/upcoming/:id/ticket-image', async (req, res) => {
  const show = await db.queryRow(`SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!show) return res.status(404).json({ error: 'Show not found' });

  if (show.ticket_image) {
    const filePath = path.join(ticketsDir, show.ticket_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.query('UPDATE upcoming SET ticket_image = NULL WHERE id = $1', [show.id]);
  res.json({ success: true });
});

// Poster image upload (concerts)
app.post('/api/concerts/:id/poster-image', posterUpload.single('poster'), async (req, res) => {
  const concert = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  if (concert.poster_image) {
    const oldPath = path.join(postersDir, concert.poster_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  await db.query('UPDATE concerts SET poster_image = $1 WHERE id = $2', [req.file.filename, concert.id]);
  res.json({ poster_image: req.file.filename });
});

// Delete poster image (concerts)
app.delete('/api/concerts/:id/poster-image', async (req, res) => {
  const concert = await db.queryRow(`SELECT * FROM concerts WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  if (concert.poster_image) {
    const filePath = path.join(postersDir, concert.poster_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.query('UPDATE concerts SET poster_image = NULL WHERE id = $1', [concert.id]);
  res.json({ success: true });
});

// Poster image upload (upcoming)
app.post('/api/upcoming/:id/poster-image', posterUpload.single('poster'), async (req, res) => {
  const show = await db.queryRow(`SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  if (show.poster_image) {
    const oldPath = path.join(postersDir, show.poster_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  await db.query('UPDATE upcoming SET poster_image = $1 WHERE id = $2', [req.file.filename, show.id]);
  res.json({ poster_image: req.file.filename });
});

// Delete poster image (upcoming)
app.delete('/api/upcoming/:id/poster-image', async (req, res) => {
  const show = await db.queryRow(`SELECT * FROM upcoming WHERE id = $1 AND ${US(2)}`, [req.params.id, req.userId]);
  if (!show) return res.status(404).json({ error: 'Show not found' });

  if (show.poster_image) {
    const filePath = path.join(postersDir, show.poster_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.query('UPDATE upcoming SET poster_image = NULL WHERE id = $1', [show.id]);
  res.json({ success: true });
});

function generateTicketArt(concert, style) {
  const dateObj = concert.date ? new Date(concert.date + 'T00:00:00') : null;
  const dayOfWeek = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '';
  const monthDay = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase().replace(',', '') : '';
  const year = dateObj ? dateObj.getFullYear() : '';
  const fullDate = dateObj ? `${dayOfWeek} ${monthDay}, ${year}` : 'DATE TBD';
  const timeStr = '7:30PM';

  const section = concert.section || concert.notes?.match(/sec(?:tion)?\s*(\w+)/i)?.[1] || '';
  const row = concert.notes?.match(/row\s*(\w+)/i)?.[1] || '';
  const seat = concert.notes?.match(/seat\s*(\w+)/i)?.[1] || '';

  const rChar = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const rNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const serialPrefix = `${rChar()}${rChar()}${rNum(0,9)}${rNum(0,9)}${rNum(0,9)}${rNum(0,9)}`;
  const serialSuffix = `${rNum(10000,99999)}`;
  const sectionCode = section || 'GENADM';
  const rowCode = row || `${rNum(100,999)}`;
  const seatCode = seat || String(rNum(1, 40));
  const price = concert.price ? `$${Number(concert.price).toFixed(2)}` : '$0.00';

  const artist = (concert.artist || 'ARTIST').toUpperCase();
  const venue = (concert.venue || 'VENUE').toUpperCase();
  const city = (concert.city || '').toUpperCase();

  // Color palettes — banner/accents use bold color, body is cream paper
  const colorSchemes = {
    blue:   { paper: '#f2ede6', stock: '#5b8fbf', stockDk: '#3a6a9a', ink: '#0a1a30', inkLt: '#3a5068', faded: '#6888a8', bannerText: '#c8ddf0' },
    gold:   { paper: '#f2ede6', stock: '#c8a848', stockDk: '#a08830', ink: '#1a1400', inkLt: '#5a4a20', faded: '#8a7a38', bannerText: '#f0e8c8' },
    red:    { paper: '#f2ede6', stock: '#c85848', stockDk: '#a03828', ink: '#1a0800', inkLt: '#5a2818', faded: '#8a4838', bannerText: '#f0d8d4' },
    green:  { paper: '#f2ede6', stock: '#58a068', stockDk: '#388048', ink: '#001a08', inkLt: '#184a28', faded: '#389048', bannerText: '#d4ecd8' },
    purple: { paper: '#f2ede6', stock: '#8868a8', stockDk: '#684888', ink: '#0a0018', inkLt: '#382858', faded: '#685888', bannerText: '#e0d4ec' },
    teal:   { paper: '#f2ede6', stock: '#488898', stockDk: '#286878', ink: '#001820', inkLt: '#183848', faded: '#387888', bannerText: '#c8e0e8' },
  };

  const styleKeys = Object.keys(colorSchemes);
  const actualStyle = style === 'random' ? styleKeys[rNum(0, styleKeys.length - 1)] : style;
  const c = colorSchemes[actualStyle] || colorSchemes.blue;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── Ticket dimensions: 260×200 (half-width, like a torn stub keeper) ──
  const W = 260, H = 200;
  const pad = 5; // padding from scanner bed edge
  const tW = W - pad * 2, tH = H - pad * 2; // ticket paper dimensions
  const cx = W / 2; // center x

  // Barcode (horizontal, compact)
  let barcode = '';
  let bx = 0;
  for (let i = 0; i < 40; i++) {
    const w = [1, 1.5, 2, 2.5][rNum(0,3)];
    if (i % 2 === 0) barcode += `<rect x="${bx}" y="0" width="${w}" height="14" fill="${c.ink}" opacity="0.7"/>`;
    bx += w + [0.5, 0.8, 1][rNum(0,2)];
  }

  const grainSeed = rNum(1, 9999);
  const rot = (rNum(-4, 4) / 10).toFixed(1);
  const ticketNum = `NTC${rNum(1000,9999)}${rNum(10000,99999)}`;

  // Torn left edge — jagged path where the stub was ripped off
  let tornPath = `M ${pad} ${pad}`;
  for (let y = pad; y < pad + tH; y += rNum(3, 7)) {
    const jag = pad + rNum(-2, 4);
    tornPath += ` L ${jag} ${Math.min(y + rNum(2, 6), pad + tH)}`;
  }
  tornPath += ` L ${pad} ${pad + tH}`;

  // Artist font size — scale for width (normal weight needs less room than bold)
  const artistSize = artist.length > 28 ? 13 : artist.length > 22 ? 15 : artist.length > 16 ? 18 : artist.length > 12 ? 22 : 26;

  // Foxing spots
  const foxingCount = rNum(2, 6);
  let foxing = '';
  for (let f = 0; f < foxingCount; f++) {
    foxing += `<circle cx="${rNum(pad + 10, W - pad - 10)}" cy="${rNum(pad + 10, H - pad - 10)}" r="${rNum(1, 3)}" fill="#a08050" opacity="${(rNum(3,7)/100).toFixed(2)}"/>`;
  }

  const creaseY = rNum(70, 130);
  const stainX = rNum(60, 200);
  const stainY = rNum(30, 170);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.0" numOctaves="5" seed="${grainSeed}" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="grained"/>
      <feComponentTransfer in="grained"><feFuncA type="linear" slope="1"/></feComponentTransfer>
    </filter>
    <filter id="age">
      <feColorMatrix type="matrix" values="1.05 0.06 0.02 0 0.02  0.01 1.02 0.01 0 0.01  0 0.01 0.90 0 -0.02  0 0 0 1 0"/>
    </filter>
    <filter id="scanned"><feGaussianBlur stdDeviation="0.25"/></filter>
    <clipPath id="tornEdge">
      <path d="${tornPath} L ${W - pad} ${pad + tH} L ${W - pad} ${pad} Z"/>
    </clipPath>
    <style>
      .tk-title { font-family: Arial, Helvetica, sans-serif; font-weight: 600; }
      .tk-body { font-family: Arial, Helvetica, sans-serif; font-weight: 400; }
      .tk-mono { font-family: 'Courier New', monospace; font-weight: 400; }
    </style>
  </defs>

  <!-- Scanner bed -->
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>

  <g transform="rotate(${rot}, ${W/2}, ${H/2})" filter="url(#age)">

    <!-- Ticket body clipped to torn edge -->
    <g clip-path="url(#tornEdge)">

      <!-- Cream paper -->
      <rect x="${pad}" y="${pad}" width="${tW}" height="${tH}" fill="${c.paper}"/>
      <rect x="${pad}" y="${pad}" width="${tW}" height="${tH}" filter="url(#grain)" opacity="0.12"/>

      <!-- Edge yellowing -->
      <rect x="${pad}" y="${pad}" width="15" height="${tH}" fill="#d8c898" opacity="0.12"/>
      <rect x="${W - pad - 15}" y="${pad}" width="15" height="${tH}" fill="#d8c898" opacity="0.08"/>
      <rect x="${pad}" y="${pad}" width="${tW}" height="12" fill="#d8c898" opacity="0.06"/>
      <rect x="${pad}" y="${H - pad - 12}" width="${tW}" height="12" fill="#d8c898" opacity="0.08"/>

      <!-- Age stain -->
      <circle cx="${stainX}" cy="${stainY}" r="${rNum(20,40)}" fill="#c8a860" opacity="0.06"/>

      <!-- Foxing spots -->
      ${foxing}

      <!-- Fold crease -->
      <line x1="${pad}" y1="${creaseY}" x2="${W - pad}" y2="${creaseY}" stroke="#a09070" stroke-width="0.4" opacity="0.10"/>

      <!-- ══ TOP BANNER — colored ══ -->
      <rect x="${pad}" y="${pad}" width="${tW}" height="14" fill="${c.stockDk}"/>
      <text x="${cx}" y="${pad + 10}" text-anchor="middle" class="tk-body" font-size="4" fill="${c.bannerText}" letter-spacing="1.2">NO REFUNDS / EXCHANGES · NOT REFUNDABLE</text>

      <g filter="url(#scanned)">

        <!-- Serial top-right -->
        <text x="${W - pad - 6}" y="${pad + 25}" text-anchor="end" class="tk-mono" font-size="3.5" fill="${c.faded}" opacity="0.5">${esc(serialPrefix)}</text>

        <!-- Venue -->
        <text x="${cx}" y="${pad + 33}" text-anchor="middle" class="tk-title" font-size="10" fill="${c.ink}" letter-spacing="0.8">${esc(venue.length > 26 ? venue.substring(0,24)+'..' : venue)}</text>
        <text x="${cx}" y="${pad + 43}" text-anchor="middle" class="tk-body" font-size="6.5" fill="${c.inkLt}" letter-spacing="0.3">${esc(city)}</text>

        <!-- Separator -->
        <line x1="${pad + 10}" y1="${pad + 48}" x2="${W - pad - 10}" y2="${pad + 48}" stroke="${c.ink}" stroke-width="0.3" opacity="0.20"/>

        <!-- Presenter -->
        <text x="${cx}" y="${pad + 57}" text-anchor="middle" class="tk-body" font-size="4.5" fill="${c.faded}" letter-spacing="1.5">AN EVENING WITH</text>

        <!-- ★ ARTIST NAME ★ -->
        <text x="${cx}" y="${pad + 78}" text-anchor="middle" class="tk-title" font-size="${artistSize}" fill="${c.ink}" letter-spacing="1">${esc(artist.length > 28 ? artist.substring(0,26)+'..' : artist)}</text>

        <!-- Date + Time -->
        <text x="${cx}" y="${pad + 96}" text-anchor="middle" class="tk-title" font-size="9" fill="${c.ink}">${esc(fullDate)}  ${timeStr}</text>

        <!-- Divider -->
        <line x1="${pad + 8}" y1="${pad + 103}" x2="${W - pad - 8}" y2="${pad + 103}" stroke="${c.ink}" stroke-width="0.3" opacity="0.20"/>

        <!-- Info band -->
        <rect x="${pad}" y="${pad + 106}" width="${tW}" height="24" fill="${c.stock}" opacity="0.10"/>

        <!-- Section / Row / Seat / Price -->
        <text x="${pad + 30}" y="${pad + 114}" text-anchor="middle" class="tk-body" font-size="3.5" fill="${c.faded}">SECTION</text>
        <rect x="${pad + 8}" y="${pad + 116}" width="44" height="12" rx="1" fill="${c.stock}" opacity="0.08"/>
        <text x="${pad + 30}" y="${pad + 125}" text-anchor="middle" class="tk-title" font-size="7" fill="${c.ink}">${esc(sectionCode.length > 7 ? sectionCode.substring(0,6) : sectionCode)}</text>

        <text x="${pad + 82}" y="${pad + 114}" text-anchor="middle" class="tk-body" font-size="3.5" fill="${c.faded}">ROW</text>
        <rect x="${pad + 60}" y="${pad + 116}" width="44" height="12" rx="1" fill="${c.stock}" opacity="0.08"/>
        <text x="${pad + 82}" y="${pad + 125}" text-anchor="middle" class="tk-title" font-size="7" fill="${c.ink}">${esc(rowCode)}</text>

        <text x="${pad + 134}" y="${pad + 114}" text-anchor="middle" class="tk-body" font-size="3.5" fill="${c.faded}">SEAT</text>
        <rect x="${pad + 112}" y="${pad + 116}" width="44" height="12" rx="1" fill="${c.stock}" opacity="0.08"/>
        <text x="${pad + 134}" y="${pad + 125}" text-anchor="middle" class="tk-title" font-size="7" fill="${c.ink}">${esc(seatCode)}</text>

        <text x="${W - pad - 32}" y="${pad + 114}" text-anchor="middle" class="tk-body" font-size="3.5" fill="${c.faded}">PRICE</text>
        <rect x="${W - pad - 54}" y="${pad + 116}" width="44" height="12" rx="1" fill="${c.stock}" opacity="0.08"/>
        <text x="${W - pad - 32}" y="${pad + 125}" text-anchor="middle" class="tk-title" font-size="7" fill="${c.ink}">${esc(price)}</text>

        <!-- GEN ADM -->
        <text x="${cx}" y="${pad + 142}" text-anchor="middle" class="tk-mono" font-size="5.5" fill="${c.ink}" letter-spacing="2">GEN ADM</text>

      </g>

      <!-- Barcode -->
      <g transform="translate(${cx - bx/2}, ${pad + 148})">${barcode}</g>
      <text x="${cx}" y="${pad + 172}" text-anchor="middle" class="tk-mono" font-size="3.5" fill="${c.faded}" letter-spacing="0.5">${esc(ticketNum)}  ${esc(sectionCode.length > 7 ? sectionCode.substring(0,6) : sectionCode)}  ${esc(serialSuffix)}</text>

      <!-- Edge wear -->
      <rect x="${pad}" y="${pad}" width="8" height="8" fill="#000" opacity="0.06" rx="1"/>
      <rect x="${W - pad - 8}" y="${pad}" width="8" height="8" fill="#000" opacity="0.05" rx="1"/>
      <rect x="${pad}" y="${H - pad - 8}" width="8" height="8" fill="#000" opacity="0.07" rx="1"/>
      <rect x="${W - pad - 8}" y="${H - pad - 8}" width="8" height="8" fill="#000" opacity="0.06" rx="1"/>
      <!-- Scuffs -->
      <rect x="${rNum(40, 140)}" y="${pad}" width="${rNum(20, 40)}" height="2" fill="#000" opacity="0.03"/>
      <rect x="${rNum(100, 220)}" y="${H - pad - 2}" width="${rNum(20, 40)}" height="2" fill="#000" opacity="0.04"/>
      <!-- Faded handling patch -->
      <rect x="${rNum(60, 160)}" y="${rNum(50, 120)}" width="${rNum(30, 50)}" height="${rNum(15, 30)}" rx="6" fill="#f8f4ee" opacity="0.05"/>

    </g>

    <!-- Torn edge shadow (subtle depth along the rip) -->
    <path d="${tornPath}" fill="none" stroke="#000" stroke-width="0.8" opacity="0.15"/>

  </g>
</svg>`;
}

// Tickets endpoint (combined concerts + upcoming for carousel)
// Exclude festival children — show ONE ticket per festival (the parent)
app.get('/api/tickets', async (req, res) => {
  const uid = req.userId;
  const concerts = await db.queryRows(
    `SELECT id, artist, venue, city, date, price, rating, last_minute, ticket_art_svg, ticket_image, poster_image, 'past' as type FROM concerts WHERE parent_concert_id IS NULL AND ${US(1)} ORDER BY date DESC`,
    [uid]
  );
  const upcomingShows = await db.queryRows(
    `SELECT id, artist, venue, city, date, price, NULL as rating, last_minute, ticket_art_svg, ticket_image, poster_image, 'upcoming' as type FROM upcoming WHERE ${US(1)} ORDER BY date ASC`,
    [uid]
  );
  const all = [...upcomingShows, ...concerts];
  res.json(all);
});

// Export
app.get('/api/export', async (req, res) => {
  const uid = req.userId;
  const concerts = await db.queryRows(`SELECT * FROM concerts WHERE ${US(1)}`, [uid]);
  const upcoming = await db.queryRows(`SELECT * FROM upcoming WHERE ${US(1)}`, [uid]);
  const wishlist = await db.queryRows(`SELECT * FROM wishlist WHERE ${US(1)}`, [uid]);
  res.setHeader('Content-Disposition', 'attachment; filename="giglog-export.json"');
  res.json({ concerts, upcoming, wishlist, exported_at: new Date().toISOString() });
});

// Import
app.post('/api/import', async (req, res) => {
  const { concerts, upcoming, wishlist } = req.body;
  if (!concerts && !upcoming && !wishlist) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const uid = req.userId;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    let imported = { concerts: 0, upcoming: 0, wishlist: 0 };

    if (concerts && concerts.length) {
      // Only delete current user's concerts (or unowned in dev mode)
      if (uid) {
        await client.query('DELETE FROM concerts WHERE user_id = $1', [uid]);
      } else {
        await client.query('DELETE FROM concerts');
      }
      for (const c of concerts) {
        await client.query(
          'INSERT INTO concerts (user_id, artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [uid, c.artist, c.venue, c.city, c.date, c.price, c.rating, c.notes, c.last_minute ? 1 : 0, c.setlist_fm_id, c.created_at || new Date().toISOString()]
        );
      }
      imported.concerts = concerts.length;
    }

    if (upcoming && upcoming.length) {
      if (uid) {
        await client.query('DELETE FROM upcoming WHERE user_id = $1', [uid]);
      } else {
        await client.query('DELETE FROM upcoming');
      }
      for (const u of upcoming) {
        await client.query(
          'INSERT INTO upcoming (user_id, artist, venue, city, date, price, section, last_minute, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [uid, u.artist, u.venue, u.city, u.date, u.price, u.section, u.last_minute ? 1 : 0, u.notes, u.created_at || new Date().toISOString()]
        );
      }
      imported.upcoming = upcoming.length;
    }

    if (wishlist && wishlist.length) {
      if (uid) {
        await client.query('DELETE FROM wishlist WHERE user_id = $1', [uid]);
      } else {
        await client.query('DELETE FROM wishlist');
      }
      for (const w of wishlist) {
        await client.query(
          'INSERT INTO wishlist (user_id, artist, priority, max_price, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
          [uid, w.artist, w.priority, w.max_price, w.notes, w.created_at || new Date().toISOString()]
        );
      }
      imported.wishlist = wishlist.length;
    }

    await client.query('COMMIT');
    res.json({ message: 'Import complete', imported });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Global error handler for unhandled async errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Production: serve client build
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Initialize database then start server
db.init().then(() => {
  // Now that db is initialized, set up session store
  if (db.pool) {
    const PgStore = connectPgSimple(session);
    sessionConfig.store = new PgStore({ pool: db.pool, tableName: 'session', createTableIfMissing: true });
  }
  sessionMiddleware = session(sessionConfig);

  app.listen(PORT, () => {
    console.log(`GigLog server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
