// Shared helpers for matching/ranking On Deck (SeatGeek) shows against the user's history.

// Normalize an artist name for exact matching — case/punctuation/"the"-insensitive.
export function normalizeArtist(s) {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
}

// Build exact-match predicates from the user's past artists + wishlist.
// pastArtists may be plain name strings or { artist, count } objects.
export function onDeckMatchers(pastArtists, wishlist) {
  // Sum seen-counts per normalized name (so different spellings merge)
  const pastCount = new Map()
  for (const p of (pastArtists || [])) {
    const name = typeof p === 'string' ? p : p.artist
    const count = typeof p === 'string' ? 1 : (p.count || 1)
    const key = normalizeArtist(name)
    if (!key) continue
    pastCount.set(key, (pastCount.get(key) || 0) + count)
  }
  const wish = new Set((wishlist || []).map(w => normalizeArtist(w.artist || w)).filter(Boolean))
  return {
    isWishlist: (name) => wish.has(normalizeArtist(name)),
    isPast: (name) => pastCount.has(normalizeArtist(name)),
    seenCount: (name) => pastCount.get(normalizeArtist(name)) || 0,
  }
}

// Sort events so the ones you care about float up: wishlist, then seen-before, then the rest
// (soonest first within each tier).
export function sortForYou(events, m) {
  return [...events].sort((a, b) => {
    const as = m.isWishlist(a.artist) ? 2 : m.isPast(a.artist) ? 1 : 0
    const bs = m.isWishlist(b.artist) ? 2 : m.isPast(b.artist) ? 1 : 0
    if (as !== bs) return bs - as
    return (a.date || '').localeCompare(b.date || '')
  })
}
