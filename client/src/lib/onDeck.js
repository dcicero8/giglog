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
export function onDeckMatchers(pastArtists, wishlist) {
  const past = new Set((pastArtists || []).map(normalizeArtist).filter(Boolean))
  const wish = new Set((wishlist || []).map(w => normalizeArtist(w.artist || w)).filter(Boolean))
  return {
    isWishlist: (name) => wish.has(normalizeArtist(name)),
    isPast: (name) => past.has(normalizeArtist(name)),
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
