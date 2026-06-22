// Compute the same insights shape as /api/insights, but client-side from a list of
// top-level concerts (festival parents + solo shows, with festival children attached).
// A festival counts as ONE show; artists/venues/locations are counted per act.
export function computeInsights(concerts) {
  const events = concerts || [] // top-level = festival parents + solo shows
  const acts = events.flatMap(c => (c.children && c.children.length) ? c.children : [c])

  const byYear = {}, byMonth = {}
  for (const e of events) {
    if (!e.date) continue
    byYear[e.date.slice(0, 4)] = (byYear[e.date.slice(0, 4)] || 0) + 1
    const m = parseInt(e.date.slice(5, 7), 10)
    if (m >= 1 && m <= 12) byMonth[m] = (byMonth[m] || 0) + 1
  }

  const artistCount = {}, venueVisits = {}
  const cities = new Set(), states = new Set(), countries = new Set()
  for (const a of acts) {
    if (a.artist) artistCount[a.artist] = (artistCount[a.artist] || 0) + 1
    if (a.venue) {
      if (!venueVisits[a.venue]) venueVisits[a.venue] = new Set()
      venueVisits[a.venue].add(a.date || ('id:' + a.id))
    }
    if (a.city) {
      cities.add(a.city)
      const parts = a.city.split(',').map(s => s.trim()).filter(Boolean)
      if (parts.length >= 2) states.add(parts[1])
      if (parts.length >= 1) countries.add(parts[parts.length - 1])
    }
  }

  const rank = (obj) => Object.entries(obj)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return {
    totalShows: events.length,
    showsByYear: Object.entries(byYear).map(([year, count]) => ({ year, count })).sort((a, b) => a.year.localeCompare(b.year)),
    showsByMonth: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: byMonth[i + 1] || 0 })),
    topArtists: rank(artistCount).slice(0, 12),
    topVenues: Object.entries(venueVisits).map(([name, set]) => ({ name, count: set.size })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 12),
    locations: { cities: cities.size, states: states.size, countries: countries.size },
  }
}
