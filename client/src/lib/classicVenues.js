// Venues you've rated 5 stars earn a "Classic Venue" badge.
export function getClassicVenueNames(venues) {
  if (!Array.isArray(venues)) return new Set()
  return new Set(venues.filter(v => v.rating === 5).map(v => v.venue))
}
