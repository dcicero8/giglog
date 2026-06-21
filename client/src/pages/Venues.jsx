import { useState, useEffect } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import StarRating from '../components/StarRating'
import TopVenueBadge from '../components/TopVenueBadge'
import { getTopVenueNames } from '../lib/topVenues'

export default function Venues() {
  const { data, loading } = useApi('/venues')
  const [venues, setVenues] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('rating')

  // Keep a local copy so rating changes can update instantly (optimistic)
  useEffect(() => { setVenues(data || []) }, [data])

  async function rateVenue(venue, rating) {
    const next = rating === venues.find(v => v.venue === venue)?.rating ? 0 : rating
    setVenues(prev => prev.map(v => v.venue === venue ? { ...v, rating: next || null } : v))
    try {
      await api.put('/venues/rating', { venue, rating: next })
    } catch {
      // Revert on failure by refetching from server state
      setVenues(data || [])
    }
  }

  // Top 10 venues by rating — shared with the concert cards so the badge stays consistent
  const topTen = getTopVenueNames(venues)

  const filtered = venues
    .filter(v => !search || v.venue.toLowerCase().includes(search.toLowerCase()) || (v.city || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'shows': return b.showCount - a.showCount
        case 'rating': return (b.rating || 0) - (a.rating || 0)
        case 'recent': return (b.lastSeen || '').localeCompare(a.lastSeen || '')
        default: return a.venue.localeCompare(b.venue)
      }
    })

  const fmtMonth = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Venues</h1>
        <span className="text-sm text-text-muted">
          {venues.length} venue{venues.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Sort + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-bg-input border border-border text-text cursor-pointer"
        >
          <option value="rating">Top Rated</option>
          <option value="alpha">A–Z</option>
          <option value="shows">Most Shows</option>
          <option value="recent">Most Recent</option>
        </select>

        <input
          type="text"
          placeholder="Search venues or cities..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-bg-card border border-border rounded-lg p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">
            {search ? 'No venues match your search' : 'No venues yet'}
          </p>
          <p className="text-text-dim text-sm">
            {search ? 'Try a different search' : 'Start logging concerts to build your venue list!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <div key={v.venue} className="bg-bg-card border border-border rounded-lg p-4 hover:bg-bg-card-hover transition-colors flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-heading font-bold text-sm text-text flex items-center gap-2">
                  {v.venue}
                  {topTen.has(v.venue) && <TopVenueBadge />}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  {v.city && <span>{v.city}</span>}
                  <span>{v.showCount} show{v.showCount !== 1 ? 's' : ''}</span>
                  {v.artistCount > 0 && (
                    <span>{v.artistCount} artist{v.artistCount !== 1 ? 's' : ''}</span>
                  )}
                  {v.firstSeen && (
                    <span className="text-text-dim hidden sm:inline">
                      {v.firstSeen === v.lastSeen ? fmtMonth(v.firstSeen) : `${fmtMonth(v.firstSeen)} – ${fmtMonth(v.lastSeen)}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {v.totalSpent > 0 && (
                  <span className="text-success text-xs hidden sm:inline">${v.totalSpent.toFixed(0)} spent</span>
                )}
                <StarRating rating={v.rating || 0} onChange={r => rateVenue(v.venue, r)} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
