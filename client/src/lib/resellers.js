const encode = (s) => encodeURIComponent(s)

export const RESELLERS = [
  { name: 'StubHub', key: 'stubhub', getUrl: (a) => `https://www.stubhub.com/search?q=${encode(a)}` },
  { name: 'SeatGeek', key: 'seatgeek', getUrl: (a) => `https://seatgeek.com/search?q=${encode(a)}` },
  { name: 'Vivid Seats', key: 'vividseats', getUrl: (a) => `https://www.vividseats.com/search?searchTerm=${encode(a)}` },
  { name: 'Ticketmaster', key: 'ticketmaster', getUrl: (a) => `https://www.ticketmaster.com/search?q=${encode(a)}` },
  { name: 'TickPick', key: 'tickpick', getUrl: (a) => `https://www.tickpick.com/search?q=${encode(a)}` },
]

export const EBAY_CATEGORIES = [
  { label: 'All Memorabilia', query: 'concert' },
  { label: 'Poster', query: 'poster' },
  { label: 'T-Shirt', query: 'shirt' },
  { label: 'Ticket Stub', query: 'ticket stub' },
  { label: 'Vinyl', query: 'vinyl' },
]

export function getEbayUrl(artist, venue, year, category = 'concert') {
  const parts = [artist, venue, year, category].filter(Boolean)
  return `https://www.ebay.com/sch/i.html?_nkw=${encode(parts.join(' '))}`
}

// YouTube search URLs
export function getYouTubeExactShowUrl(artist, venue, year) {
  const q = [artist, venue, year, 'live'].filter(Boolean).join(' ')
  return `https://www.youtube.com/results?search_query=${encode(q)}`
}

export function getYouTubeFullSetsUrl(artist) {
  return `https://www.youtube.com/results?search_query=${encode(artist + ' live concert full set')}`
}

// Spotify search URLs
export function getSpotifyArtistUrl(artist) {
  return `https://open.spotify.com/search/${encode(artist)}`
}

export function getSpotifySongUrl(artist, songName) {
  return `https://open.spotify.com/search/${encode(artist + ' ' + songName)}`
}
