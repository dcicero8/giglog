// Returns a Set of the user's top-10 venue names by rating.
// Only meaningful when there are more than 10 venues, matching the Venues page.
// Tiebreak: rating desc, then show count desc, then name.
export function getTopVenueNames(venues) {
  if (!Array.isArray(venues) || venues.length <= 10) return new Set()
  return new Set(
    [...venues]
      .filter(v => v.rating)
      .sort((a, b) => (b.rating - a.rating) || (b.showCount - a.showCount) || a.venue.localeCompare(b.venue))
      .slice(0, 10)
      .map(v => v.venue)
  )
}
