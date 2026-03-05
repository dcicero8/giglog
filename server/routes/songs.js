import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/songs — aggregate all songs from cached setlists
router.get('/', (req, res) => {
  // Get all concerts (regular + festival children) that have a linked setlist
  const concerts = db.prepare(
    `SELECT id, artist, venue, city, date, rating, setlist_fm_id, parent_concert_id
     FROM concerts
     WHERE setlist_fm_id IS NOT NULL
     ORDER BY date ASC`
  ).all();

  const allSongs = [];
  let showsWithData = 0;

  for (const concert of concerts) {
    // Read from setlist cache (never call the API)
    const cached = db.prepare(
      "SELECT response FROM setlist_cache WHERE cache_key = ?"
    ).get(`setlist:${concert.setlist_fm_id}`);

    if (!cached) continue;

    let setlistData;
    try {
      setlistData = JSON.parse(cached.response);
    } catch {
      continue;
    }

    if (!setlistData?.sets?.set) continue;

    let hasSongs = false;
    for (const set of setlistData.sets.set) {
      if (!set.song?.length) continue;
      for (const song of set.song) {
        if (!song.name) continue;
        hasSongs = true;
        allSongs.push({
          song: song.name,
          artist: concert.artist,
          venue: concert.venue || '',
          city: concert.city || '',
          date: concert.date || '',
          rating: concert.rating || null,
          concertId: concert.id,
          isCover: !!song.cover,
          coverOf: song.cover?.name || null,
          isEncore: !!set.encore,
          isTape: !!song.tape,
          info: song.info || null,
          setName: set.name || (set.encore ? `Encore${set.encore > 1 ? ' ' + set.encore : ''}` : null),
        });
      }
    }
    if (hasSongs) showsWithData++;
  }

  // Build frequency map
  const freqMap = {};
  for (const s of allSongs) {
    const key = s.song.toLowerCase();
    if (!freqMap[key]) {
      freqMap[key] = { song: s.song, count: 0, concerts: [] };
    }
    freqMap[key].count++;
    freqMap[key].concerts.push({
      artist: s.artist,
      venue: s.venue,
      city: s.city,
      date: s.date,
      concertId: s.concertId,
    });
  }

  const songsByFrequency = Object.values(freqMap)
    .sort((a, b) => b.count - a.count || a.song.localeCompare(b.song));

  // Stats
  const coverCount = allSongs.filter(s => s.isCover).length;
  const encoreCount = allSongs.filter(s => s.isEncore).length;

  res.json({
    songs: allSongs,
    songsByFrequency,
    stats: {
      totalSongs: allSongs.length,
      uniqueSongs: Object.keys(freqMap).length,
      totalShows: showsWithData,
      coverCount,
      encoreCount,
    },
  });
});

export default router;
