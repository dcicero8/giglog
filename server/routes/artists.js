import { Router } from 'express';
import db from '../db.js';

const router = Router();

const US = (n) => `($${n}::int IS NULL OR user_id = $${n})`;
const FESTIVAL_PARENT_IDS = (n) => `SELECT DISTINCT parent_concert_id FROM concerts WHERE parent_concert_id IS NOT NULL AND ${US(n)}`;

// GET /api/artists/network — nodes (artists sized by times seen) + links (artists
// who shared a show: same festival, or same venue+date co-bill).
router.get('/network', async (req, res) => {
  const uid = req.userId;

  // Every act actually attended: standalone shows + festival children.
  // Festival parent containers (their `artist` is the festival name) are excluded.
  const rows = await db.queryRows(
    `SELECT id, artist, venue, date, parent_concert_id
     FROM concerts
     WHERE ${US(1)} AND id NOT IN (${FESTIVAL_PARENT_IDS(1)})`,
    [uid]
  );

  // Aggregate artists by a normalized key, keeping the most-seen display spelling.
  const nodes = new Map(); // key -> { name, count, spellings: Map }
  // Group acts by "show" so we can connect everyone who shared one.
  const shows = new Map(); // showKey -> Set of artist keys

  for (const r of rows) {
    const name = (r.artist || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();

    let node = nodes.get(key);
    if (!node) { node = { name, count: 0, spellings: new Map() }; nodes.set(key, node); }
    node.count++;
    node.spellings.set(name, (node.spellings.get(name) || 0) + 1);

    const showKey = r.parent_concert_id != null
      ? `p${r.parent_concert_id}`
      : `s|${r.date || ''}|${(r.venue || '').toLowerCase().trim()}`;
    if (!shows.has(showKey)) shows.set(showKey, new Set());
    shows.get(showKey).add(key);
  }

  // Pick each artist's most-common spelling for display.
  for (const node of nodes.values()) {
    let best = node.name, bestN = 0;
    for (const [sp, n] of node.spellings) if (n > bestN) { best = sp; bestN = n; }
    node.name = best;
    delete node.spellings;
  }

  // Build weighted links from co-occurrence within each show.
  const linkMap = new Map(); // "a||b" -> weight
  for (const set of shows.values()) {
    const acts = [...set];
    if (acts.length < 2) continue;
    for (let i = 0; i < acts.length; i++) {
      for (let j = i + 1; j < acts.length; j++) {
        const [a, b] = acts[i] < acts[j] ? [acts[i], acts[j]] : [acts[j], acts[i]];
        const k = `${a}||${b}`;
        linkMap.set(k, (linkMap.get(k) || 0) + 1);
      }
    }
  }

  const nodeList = [...nodes.entries()].map(([id, n]) => ({ id, name: n.name, count: n.count }));
  const links = [...linkMap.entries()].map(([k, weight]) => {
    const [source, target] = k.split('||');
    return { source, target, weight };
  });

  res.json({ nodes: nodeList, links });
});

export default router;
