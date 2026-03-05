import { Router } from 'express';
import db from '../db.js';

const router = Router();

const SETLISTFM_BASE = 'https://api.setlist.fm/rest/1.0';

// Token bucket rate limiter
const rateLimiter = {
  tokens: 2,
  maxTokens: 2,
  lastRefill: Date.now(),
  refillRate: 2, // tokens per second

  canMakeRequest() {
    this.refillTokens();
    const today = new Date().toISOString().split('T')[0];
    const usage = db.prepare('SELECT request_count FROM api_usage WHERE date = ?').get(today);
    const dailyCount = usage ? usage.request_count : 0;
    return this.tokens >= 1 && dailyCount < 1440;
  },

  consumeToken() {
    this.tokens -= 1;
    const today = new Date().toISOString().split('T')[0];
    db.prepare(
      'INSERT INTO api_usage (date, request_count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET request_count = request_count + 1'
    ).run(today);
  },

  refillTokens() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  },
};

// Cache helpers
function getCached(cacheKey) {
  const row = db.prepare(
    "SELECT response FROM setlist_cache WHERE cache_key = ? AND expires_at > datetime('now')"
  ).get(cacheKey);
  return row ? JSON.parse(row.response) : null;
}

function setCache(cacheKey, data, ttlHours) {
  db.prepare(
    "INSERT OR REPLACE INTO setlist_cache (cache_key, response, fetched_at, expires_at) VALUES (?, ?, datetime('now'), datetime('now', ?))"
  ).run(cacheKey, JSON.stringify(data), `+${ttlHours} hours`);
}

async function fetchSetlistFm(endpoint) {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) throw new Error('SETLISTFM_API_KEY not configured');

  if (!rateLimiter.canMakeRequest()) {
    throw new Error('RATE_LIMITED');
  }

  rateLimiter.consumeToken();

  const response = await fetch(`${SETLISTFM_BASE}${endpoint}`, {
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`setlist.fm API error: ${response.status} ${text}`);
  }

  return response.json();
}

// Search setlists by artist and optional date
router.get('/search', async (req, res) => {
  const { artist, date } = req.query;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  try {
    const cacheKey = `search:${artist}:${date || ''}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // Convert YYYY-MM-DD to dd-MM-yyyy for setlist.fm
    let params = `artistName=${encodeURIComponent(artist)}`;
    if (date) {
      const [y, m, d] = date.split('-');
      params += `&date=${d}-${m}-${y}`;
    }

    const data = await fetchSetlistFm(`/search/setlists?${params}`);
    setCache(cacheKey, data, 24);
    res.json({ ...data, cached: false });
  } catch (err) {
    if (err.message === 'RATE_LIMITED') {
      return res.status(429).json({ error: 'Rate limit reached. Try again later.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get setlist by ID
router.get('/setlist/:id', async (req, res) => {
  try {
    const cacheKey = `setlist:${req.params.id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const data = await fetchSetlistFm(`/setlist/${req.params.id}`);
    setCache(cacheKey, data, 168); // 7 days
    res.json({ ...data, cached: false });
  } catch (err) {
    if (err.message === 'RATE_LIMITED') {
      return res.status(429).json({ error: 'Rate limit reached. Try again later.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Search artists
router.get('/artists', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    const cacheKey = `artists:${q}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const data = await fetchSetlistFm(`/search/artists?artistName=${encodeURIComponent(q)}&sort=relevance`);
    setCache(cacheKey, data, 24);
    res.json({ ...data, cached: false });
  } catch (err) {
    if (err.message === 'RATE_LIMITED') {
      return res.status(429).json({ error: 'Rate limit reached. Try again later.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Festival import — find all artists at same venue/date
router.get('/festival/:id', async (req, res) => {
  try {
    const cacheKey = `festival:${req.params.id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // Fetch the given setlist to get venue and date
    const setlist = await fetchSetlistFm(`/setlist/${req.params.id}`);
    const venueId = setlist.venue?.id;
    const eventDate = setlist.eventDate; // dd-MM-yyyy format from API

    if (!venueId || !eventDate) {
      return res.status(400).json({ error: 'Could not determine venue or date from this setlist' });
    }

    // Search for all setlists at this venue on this date
    const allSetlists = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 5) {
      const searchData = await fetchSetlistFm(
        `/search/setlists?venueId=${venueId}&date=${eventDate}&p=${page}`
      );

      if (searchData.setlist) {
        const setlists = Array.isArray(searchData.setlist) ? searchData.setlist : [searchData.setlist];
        allSetlists.push(...setlists);
      }

      totalPages = Math.ceil((searchData.total || 0) / (searchData.itemsPerPage || 20));
      page++;
    }

    // Convert date to ISO
    const [d, m, y] = eventDate.split('-');
    const isoDate = `${y}-${m}-${d}`;

    const festivalData = {
      venue: setlist.venue?.name || '',
      city: [
        setlist.venue?.city?.name,
        setlist.venue?.city?.stateCode || setlist.venue?.city?.state,
        setlist.venue?.city?.country?.code,
      ].filter(Boolean).join(', '),
      date: isoDate,
      tour: setlist.tour?.name || '',
      artists: allSetlists.map(s => ({
        artist: s.artist?.name || '',
        setlist_fm_id: s.id,
        setlist_fm_url: s.url || '',
        hasSongs: s.sets?.set?.some(set => set.song?.length > 0) || false,
        tour: s.tour?.name || '',
      })),
    };

    setCache(cacheKey, festivalData, 168); // 7 days
    res.json({ ...festivalData, cached: false });
  } catch (err) {
    if (err.message === 'RATE_LIMITED') {
      return res.status(429).json({ error: 'Rate limit reached. Try again later.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// API usage stats
router.get('/usage', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const usage = db.prepare('SELECT request_count FROM api_usage WHERE date = ?').get(today);
  res.json({
    date: today,
    requestCount: usage ? usage.request_count : 0,
    dailyLimit: 1440,
    remaining: 1440 - (usage ? usage.request_count : 0),
  });
});

export default router;
