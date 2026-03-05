import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import db from './db.js';
import concertsRouter from './routes/concerts.js';
import upcomingRouter from './routes/upcoming.js';
import wishlistRouter from './routes/wishlist.js';
import setlistfmRouter from './routes/setlistfm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// API routes
app.use('/api/concerts', concertsRouter);
app.use('/api/upcoming', upcomingRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/setlistfm', setlistfmRouter);

// Stats endpoint for dashboard
// Count children (individual bands) as shows, but not festival parents themselves
app.get('/api/stats', (req, res) => {
  // Count non-parent concerts + children, but NOT festival parent entries
  const childCount = db.prepare('SELECT COUNT(*) as count FROM concerts WHERE parent_concert_id IS NOT NULL').get().count;
  const parentCount = db.prepare('SELECT COUNT(*) as count FROM concerts WHERE parent_concert_id IS NULL AND id IN (SELECT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL)').get().count;
  const soloCount = db.prepare('SELECT COUNT(*) as count FROM concerts WHERE parent_concert_id IS NULL AND id NOT IN (SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL)').get().count;
  const concertCount = soloCount + childCount; // solo shows + festival bands (exclude festival parent as a "show")
  const upcomingCount = db.prepare('SELECT COUNT(*) as count FROM upcoming').get().count;
  const wishlistCount = db.prepare('SELECT COUNT(*) as count FROM wishlist').get().count;
  const totalSpent = db.prepare('SELECT COALESCE(SUM(price), 0) as total FROM concerts').get().total;
  const upcomingSpent = db.prepare('SELECT COALESCE(SUM(price), 0) as total FROM upcoming').get().total;
  const avgPrice = db.prepare('SELECT COALESCE(AVG(price), 0) as avg FROM concerts WHERE price IS NOT NULL AND price > 0').get().avg;
  const avgLastMinutePrice = db.prepare('SELECT COALESCE(AVG(price), 0) as avg FROM concerts WHERE last_minute = 1 AND price IS NOT NULL AND price > 0').get().avg;

  res.json({
    concertCount,
    upcomingCount,
    wishlistCount,
    totalSpent: totalSpent + upcomingSpent,
    avgPrice: Math.round(avgPrice * 100) / 100,
    avgLastMinutePrice: Math.round(avgLastMinutePrice * 100) / 100,
  });
});

// Artists aggregate endpoint
app.get('/api/artists', (req, res) => {
  // Exclude festival parent entries (they're containers like "Lollapalooza", not real artists)
  // A festival parent is a concert that has children pointing to it
  const artists = db.prepare(`
    SELECT artist, 'concert' as source, date, price, rating FROM concerts
      WHERE id NOT IN (SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL)
    UNION ALL
    SELECT artist, 'upcoming' as source, date, price, NULL as rating FROM upcoming
    UNION ALL
    SELECT artist, 'wishlist' as source, NULL as date, NULL as price, NULL as rating FROM wishlist
  `).all();

  const map = {};
  for (const row of artists) {
    if (!map[row.artist]) {
      map[row.artist] = { artist: row.artist, showCount: 0, upcomingCount: 0, wishlist: false, totalSpent: 0, ratings: [], dates: [] };
    }
    const entry = map[row.artist];
    if (row.source === 'concert') {
      entry.showCount++;
      if (row.price) entry.totalSpent += row.price;
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

  const cached = db.prepare('SELECT lat, lon FROM geocode_cache WHERE city = ?').get(city);
  if (cached) return res.json(cached);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`,
      { headers: { 'User-Agent': 'GigLog/1.0' } }
    );
    const data = await response.json();
    if (data.length === 0) return res.status(404).json({ error: 'Location not found' });

    const { lat, lon } = data[0];
    db.prepare('INSERT OR REPLACE INTO geocode_cache (city, lat, lon) VALUES (?, ?, ?)').run(city, parseFloat(lat), parseFloat(lon));
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

  const cacheKey = 'seatgeek_la_concerts_60d';
  const cached = db.prepare('SELECT response, expires_at FROM seatgeek_cache WHERE cache_key = ?').get(cacheKey);
  if (cached && new Date(cached.expires_at) > new Date()) {
    return res.json(JSON.parse(cached.response));
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const params = new URLSearchParams({
      'lat': '34.0522',
      'lon': '-118.2437',
      'range': '30mi',
      'taxonomies.name': 'concert',
      'datetime_local.gte': today,
      'datetime_local.lte': future,
      'per_page': '50',
      'sort': 'datetime_local.asc',
      'client_id': process.env.SEATGEEK_CLIENT_ID,
      ...(process.env.SEATGEEK_CLIENT_SECRET ? { 'client_secret': process.env.SEATGEEK_CLIENT_SECRET } : {}),
    });

    const response = await fetch(`https://api.seatgeek.com/2/events?${params}`);
    if (!response.ok) throw new Error(`SeatGeek API returned ${response.status}`);
    const data = await response.json();

    const events = (data.events || []).map(e => ({
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
    }));

    // Cache for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('INSERT OR REPLACE INTO seatgeek_cache (cache_key, response, expires_at) VALUES (?, ?, ?)')
      .run(cacheKey, JSON.stringify(events), expiresAt);

    res.json(events);
  } catch (err) {
    console.error('SeatGeek fetch error:', err);
    // Return stale cache if available
    if (cached) return res.json(JSON.parse(cached.response));
    res.status(500).json({ error: 'Failed to fetch events: ' + err.message });
  }
});

// Dismissed artists (hide from On Deck)
app.get('/api/dismissed-artists', (req, res) => {
  const rows = db.prepare('SELECT artist FROM dismissed_artists ORDER BY dismissed_at DESC').all();
  res.json(rows.map(r => r.artist));
});

app.post('/api/dismissed-artists', (req, res) => {
  const { artist } = req.body;
  if (!artist) return res.status(400).json({ error: 'Artist name required' });
  try {
    db.prepare('INSERT OR IGNORE INTO dismissed_artists (artist) VALUES (?)').run(artist);
  } catch (err) { /* already exists */ }
  const rows = db.prepare('SELECT artist FROM dismissed_artists ORDER BY dismissed_at DESC').all();
  res.json(rows.map(r => r.artist));
});

app.delete('/api/dismissed-artists/:artist', (req, res) => {
  db.prepare('DELETE FROM dismissed_artists WHERE artist = ?').run(decodeURIComponent(req.params.artist));
  const rows = db.prepare('SELECT artist FROM dismissed_artists ORDER BY dismissed_at DESC').all();
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

// AI ticket art generation
const TICKET_STYLES = ['blue', 'gold', 'red', 'green', 'pink', 'orange', 'random'];

app.post('/api/concerts/:id/generate-ticket', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY not configured' });
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });
  const style = TICKET_STYLES.includes(req.body.style) ? req.body.style : 'classic';
  try {
    const svg = await generateTicketArt(concert, style);
    db.prepare('UPDATE concerts SET ticket_art_svg = ? WHERE id = ?').run(svg, concert.id);
    res.json({ ticket_art_svg: svg });
  } catch (err) {
    res.status(500).json({ error: 'Generation failed: ' + err.message });
  }
});

app.post('/api/upcoming/:id/generate-ticket', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY not configured' });
  const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  const style = TICKET_STYLES.includes(req.body.style) ? req.body.style : 'classic';
  try {
    const svg = await generateTicketArt(show, style);
    db.prepare('UPDATE upcoming SET ticket_art_svg = ? WHERE id = ?').run(svg, show.id);
    res.json({ ticket_art_svg: svg });
  } catch (err) {
    res.status(500).json({ error: 'Generation failed: ' + err.message });
  }
});

app.get('/api/ai-status', (req, res) => {
  res.json({ available: !!process.env.GEMINI_API_KEY });
});

// Ticket image upload (concerts)
app.post('/api/concerts/:id/ticket-image', ticketUpload.single('ticket'), (req, res) => {
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Remove old ticket image if exists
  if (concert.ticket_image) {
    const oldPath = path.join(ticketsDir, concert.ticket_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.prepare('UPDATE concerts SET ticket_image = ? WHERE id = ?').run(req.file.filename, concert.id);
  res.json({ ticket_image: req.file.filename });
});

// Delete ticket image (concerts)
app.delete('/api/concerts/:id/ticket-image', (req, res) => {
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  if (concert.ticket_image) {
    const filePath = path.join(ticketsDir, concert.ticket_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('UPDATE concerts SET ticket_image = NULL WHERE id = ?').run(concert.id);
  res.json({ success: true });
});

// Ticket image upload (upcoming)
app.post('/api/upcoming/:id/ticket-image', ticketUpload.single('ticket'), (req, res) => {
  const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  if (show.ticket_image) {
    const oldPath = path.join(ticketsDir, show.ticket_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.prepare('UPDATE upcoming SET ticket_image = ? WHERE id = ?').run(req.file.filename, show.id);
  res.json({ ticket_image: req.file.filename });
});

// Delete ticket image (upcoming)
app.delete('/api/upcoming/:id/ticket-image', (req, res) => {
  const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!show) return res.status(404).json({ error: 'Show not found' });

  if (show.ticket_image) {
    const filePath = path.join(ticketsDir, show.ticket_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('UPDATE upcoming SET ticket_image = NULL WHERE id = ?').run(show.id);
  res.json({ success: true });
});

// Poster image upload (concerts)
app.post('/api/concerts/:id/poster-image', posterUpload.single('poster'), (req, res) => {
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  if (concert.poster_image) {
    const oldPath = path.join(postersDir, concert.poster_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.prepare('UPDATE concerts SET poster_image = ? WHERE id = ?').run(req.file.filename, concert.id);
  res.json({ poster_image: req.file.filename });
});

// Delete poster image (concerts)
app.delete('/api/concerts/:id/poster-image', (req, res) => {
  const concert = db.prepare('SELECT * FROM concerts WHERE id = ?').get(req.params.id);
  if (!concert) return res.status(404).json({ error: 'Concert not found' });

  if (concert.poster_image) {
    const filePath = path.join(postersDir, concert.poster_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('UPDATE concerts SET poster_image = NULL WHERE id = ?').run(concert.id);
  res.json({ success: true });
});

// Poster image upload (upcoming)
app.post('/api/upcoming/:id/poster-image', posterUpload.single('poster'), (req, res) => {
  const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  if (show.poster_image) {
    const oldPath = path.join(postersDir, show.poster_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.prepare('UPDATE upcoming SET poster_image = ? WHERE id = ?').run(req.file.filename, show.id);
  res.json({ poster_image: req.file.filename });
});

// Delete poster image (upcoming)
app.delete('/api/upcoming/:id/poster-image', (req, res) => {
  const show = db.prepare('SELECT * FROM upcoming WHERE id = ?').get(req.params.id);
  if (!show) return res.status(404).json({ error: 'Show not found' });

  if (show.poster_image) {
    const filePath = path.join(postersDir, show.poster_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('UPDATE upcoming SET poster_image = NULL WHERE id = ?').run(show.id);
  res.json({ success: true });
});

async function generateTicketArt(concert, style) {
  const formattedDate = concert.date
    ? new Date(concert.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date TBD';

  const dateObj = concert.date ? new Date(concert.date + 'T00:00:00') : null;
  const dayOfWeek = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() : '';
  const monthDay = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '';
  const year = dateObj ? dateObj.getFullYear() : '';

  // Generate fake ticket metadata
  const ticketCode = `${String.fromCharCode(65 + Math.floor(Math.random()*26))}${String.fromCharCode(65 + Math.floor(Math.random()*26))}${String(Math.floor(Math.random()*9000)+1000)}${String.fromCharCode(65 + Math.floor(Math.random()*26))}`;
  const serialNum = `${Math.floor(Math.random()*900)+100}${Math.floor(Math.random()*90)+10}`;
  const section = concert.notes?.match(/sec(?:tion)?\s*(\w+)/i)?.[1] || 'GENADM';
  const row = concert.notes?.match(/row\s*(\w+)/i)?.[1] || '';
  const seat = concert.notes?.match(/seat\s*(\w+)/i)?.[1] || '';

  const colorSchemes = {
    blue: 'steel blue (#4682B4) and light blue (#87CEEB)',
    gold: 'golden yellow (#DAA520) and warm cream (#FFF8DC)',
    red: 'deep red (#B22222) and salmon (#FA8072)',
    green: 'forest green (#228B22) and mint (#98FB98)',
    pink: 'hot pink (#FF69B4) and light pink (#FFB6C1)',
    orange: 'burnt orange (#CC5500) and peach (#FFDAB9)',
  };

  const actualStyle = style === 'random'
    ? Object.keys(colorSchemes)[Math.floor(Math.random() * Object.keys(colorSchemes).length)]
    : style;
  const colors = colorSchemes[actualStyle] || colorSchemes.blue;

  const prompt = `Generate an SVG (800x300px) that looks EXACTLY like a real physical concert ticket stub from the late 1980s or early 1990s — like a Ticketmaster, Ticketron, or Bass ticket.

CONCERT INFO:
- Event: ${concert.artist}
- Venue: ${concert.venue || 'VENUE'}
- City: ${concert.city || ''}
- Date: ${dayOfWeek} ${monthDay}, ${year}
- Price: ${concert.price ? '$' + Number(concert.price).toFixed(2) : '0.00'}
- Section: ${section}${row ? ` Row: ${row}` : ''}${seat ? ` Seat: ${seat}` : ''}
- Ticket code: ${ticketCode}
- Serial: ${serialNum}

CRITICAL DESIGN RULES — follow these exactly:
1. Color scheme: Use ${colors} as the main ticket stock colors. The ticket should look like it's printed on colored cardstock.
2. Layout: Main ticket on the left (~600px), tear-off stub on the right (~200px) separated by a dashed/perforated line.
3. Typography: ALL TEXT MUST BE UPPERCASE. Use bold, blocky sans-serif fonts (like Impact, Arial Black). The venue name should be very prominent at the top. The artist/event name should be large and bold.
4. Include realistic ticket details scattered around: "NO REFUNDS/EXCHANGES", "SERVICE/HANDLING CHARGES NOT REFUNDABLE", event codes, section/row/seat, the price, the date and time like "7:30PM" or "DOORS 7PM".
5. The tear-off stub should repeat key info: date, event code, section, and "GEN ADM" or section info.
6. Include a fake barcode (simple black vertical lines of varying width) at the bottom of the main section.
7. Make it look slightly rough/authentic — not too clean or digital. Use slightly different background shade rectangles, like real printed ticket stock has colored bands/sections.
8. DO NOT use any gradients, drop shadows, or modern design elements. This should look like it came out of a dot-matrix or thermal printer on colored stock paper.
9. The overall vibe should match real tickets from concerts like Lollapalooza '92, Grateful Dead '87, or Pink Floyd '94 — utilitarian, dense with info, printed on colored stock.

Return ONLY the SVG code. No markdown, no explanation, no code fences.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8000 },
      }),
    }
  );
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Gemini API free tier quota exceeded — try again tomorrow or upgrade your plan');
    }
    const errBody = await response.text();
    throw new Error(`Gemini API returned ${response.status}: ${errBody}`);
  }
  const data = await response.json();
  let svg = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (svgMatch) svg = svgMatch[0];
  if (!svg.includes('<svg')) throw new Error('No valid SVG returned');
  return svg;
}

// Tickets endpoint (combined concerts + upcoming for carousel)
// Exclude festival children — show ONE ticket per festival (the parent)
app.get('/api/tickets', (req, res) => {
  const concerts = db.prepare(`SELECT id, artist, venue, city, date, price, rating, last_minute, ticket_art_svg, ticket_image, 'past' as type FROM concerts WHERE parent_concert_id IS NULL ORDER BY date DESC`).all();
  const upcomingShows = db.prepare(`SELECT id, artist, venue, city, date, price, NULL as rating, last_minute, ticket_art_svg, ticket_image, 'upcoming' as type FROM upcoming ORDER BY date ASC`).all();
  const all = [...upcomingShows, ...concerts];
  res.json(all);
});

// Export
app.get('/api/export', (req, res) => {
  const concerts = db.prepare('SELECT * FROM concerts').all();
  const upcoming = db.prepare('SELECT * FROM upcoming').all();
  const wishlist = db.prepare('SELECT * FROM wishlist').all();
  res.setHeader('Content-Disposition', 'attachment; filename="giglog-export.json"');
  res.json({ concerts, upcoming, wishlist, exported_at: new Date().toISOString() });
});

// Import
app.post('/api/import', (req, res) => {
  const { concerts, upcoming, wishlist } = req.body;
  if (!concerts && !upcoming && !wishlist) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const importData = db.transaction(() => {
    let imported = { concerts: 0, upcoming: 0, wishlist: 0 };

    if (concerts && concerts.length) {
      db.prepare('DELETE FROM concerts').run();
      const stmt = db.prepare('INSERT INTO concerts (artist, venue, city, date, price, rating, notes, last_minute, setlist_fm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const c of concerts) {
        stmt.run(c.artist, c.venue, c.city, c.date, c.price, c.rating, c.notes, c.last_minute ? 1 : 0, c.setlist_fm_id, c.created_at || new Date().toISOString());
      }
      imported.concerts = concerts.length;
    }

    if (upcoming && upcoming.length) {
      db.prepare('DELETE FROM upcoming').run();
      const stmt = db.prepare('INSERT INTO upcoming (artist, venue, city, date, price, section, last_minute, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const u of upcoming) {
        stmt.run(u.artist, u.venue, u.city, u.date, u.price, u.section, u.last_minute ? 1 : 0, u.notes, u.created_at || new Date().toISOString());
      }
      imported.upcoming = upcoming.length;
    }

    if (wishlist && wishlist.length) {
      db.prepare('DELETE FROM wishlist').run();
      const stmt = db.prepare('INSERT INTO wishlist (artist, priority, max_price, notes, created_at) VALUES (?, ?, ?, ?, ?)');
      for (const w of wishlist) {
        stmt.run(w.artist, w.priority, w.max_price, w.notes, w.created_at || new Date().toISOString());
      }
      imported.wishlist = wishlist.length;
    }

    return imported;
  });

  const result = importData();
  res.json({ message: 'Import complete', imported: result });
});

// Production: serve client build
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`GigLog server running on http://localhost:${PORT}`);
});
