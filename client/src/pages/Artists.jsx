import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import StarRating from '../components/StarRating'

const FILTERS = [
  { key: 'seen', label: 'Seen', description: 'Bands I\'ve seen live' },
  { key: 'all', label: 'All', description: 'Including upcoming & wishlist' },
  { key: 'wishlist', label: 'Wishlist', description: 'Wishlist only' },
]

export default function Artists() {
  const { data: artists, loading } = useApi('/artists')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('seen')
  const [sortBy, setSortBy] = useState('alpha')

  const filtered = (artists || [])
    .filter(a => {
      // Search filter
      if (search && !a.artist.toLowerCase().includes(search.toLowerCase())) return false
      // Tab filter
      if (filter === 'seen') return a.showCount > 0
      if (filter === 'wishlist') return a.wishlist
      return true // 'all'
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'shows': return b.showCount - a.showCount
        case 'rating': return (b.avgRating || 0) - (a.avgRating || 0)
        case 'spent': return b.totalSpent - a.totalSpent
        case 'recent': return (b.lastSeen || '').localeCompare(a.lastSeen || '')
        default: return a.artist.localeCompare(b.artist)
      }
    })

  const seenCount = artists?.filter(a => a.showCount > 0).length || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Artists</h1>
        <span className="text-sm text-text-muted">
          {filter === 'seen' ? `${seenCount} seen` : `${filtered.length} artist${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border-0 cursor-pointer transition-colors ${
                filter === f.key
                  ? 'bg-secondary/20 text-secondary'
                  : 'bg-transparent text-text-muted hover:text-text'
              }`}
              title={f.description}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-bg-input border border-border text-text cursor-pointer"
        >
          <option value="alpha">A–Z</option>
          <option value="shows">Most Shows</option>
          <option value="rating">Top Rated</option>
          <option value="spent">Most Spent</option>
          <option value="recent">Most Recent</option>
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search artists..."
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
            {filter === 'wishlist' ? 'No artists on your wishlist' : filter === 'seen' ? 'No artists seen yet' : 'No artists found'}
          </p>
          <p className="text-text-dim text-sm">
            {filter === 'seen' ? 'Start logging concerts to build your artist list!' : 'Try a different filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.artist} className="bg-bg-card border border-border rounded-lg p-4 hover:bg-bg-card-hover transition-colors flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-heading font-bold text-sm text-text">{a.artist}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  {a.showCount > 0 && (
                    <span>{a.showCount} show{a.showCount !== 1 ? 's' : ''}</span>
                  )}
                  {a.upcomingCount > 0 && (
                    <span className="text-secondary">{a.upcomingCount} upcoming</span>
                  )}
                  {a.wishlist && (
                    <span className="text-accent">♡ wishlist</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                {a.avgRating && (
                  <StarRating rating={Math.round(a.avgRating)} readonly size="sm" />
                )}
                {a.totalSpent > 0 && (
                  <span className="text-success text-xs">${a.totalSpent.toFixed(0)} spent</span>
                )}
                {a.firstSeen && (
                  <span className="text-xs text-text-dim hidden sm:inline">
                    {a.firstSeen === a.lastSeen
                      ? new Date(a.firstSeen + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                      : `${new Date(a.firstSeen + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${new Date(a.lastSeen + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                    }
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
