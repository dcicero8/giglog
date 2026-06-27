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

function daysBetween(a, b) {
  if (!a || !b) return Infinity
  return Math.abs((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
}

// Merge a cluster of same artist+venue events (a residency/run, or exact duplicates
// SeatGeek returns under different IDs) into one card.
function mergeCluster(cluster) {
  if (cluster.length === 1) return cluster[0]
  const dated = cluster.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date))
  const first = dated[0] || cluster[0]
  const uniqueDates = [...new Set(dated.map(e => e.date))]
  const prices = cluster.map(e => e.lowest_price).filter(v => v != null)
  return {
    ...first,
    id: `run:${normalizeArtist(first.artist)}|${(first.venue || '').toLowerCase()}|${first.date || ''}`,
    date: first.date,
    nights: uniqueDates.length,
    runDates: uniqueDates,
    lowest_price: prices.length ? Math.min(...prices) : null,
    listing_count: cluster.reduce((s, e) => s + (e.listing_count || 0), 0),
  }
}

// Collapse duplicate listings and multi-night runs: group by artist+venue, then
// cluster dates within ~10 days into a single card. Keeps separate stands at the
// same venue months apart as distinct cards.
export function collapseRuns(events) {
  const groups = new Map()
  for (const e of (events || [])) {
    const key = `${normalizeArtist(e.artist)}|${(e.venue || '').toLowerCase().trim()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }
  const out = []
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    let cluster = []
    const flush = () => { if (cluster.length) out.push(mergeCluster(cluster)); cluster = [] }
    for (const e of sorted) {
      if (cluster.length && daysBetween(cluster[cluster.length - 1].date, e.date) <= 10) cluster.push(e)
      else { flush(); cluster = [e] }
    }
    flush()
  }
  return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
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
