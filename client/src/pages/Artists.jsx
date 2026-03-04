import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import StarRating from '../components/StarRating'

export default function Artists() {
  const { data: artists, loading } = useApi('/artists')
  const [search, setSearch] = useState('')

  const filtered = artists?.filter(a =>
    a.artist.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Artists</h1>
        <span className="text-sm text-text-muted">{filtered.length} artist{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <input
        type="text"
        placeholder="Search artists..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full sm:w-80 px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary mb-6"
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-bg-card border border-border rounded-lg p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">No artists found</p>
          <p className="text-text-dim text-sm">Start logging concerts to build your artist list!</p>
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
                    <span className="text-accent">on wishlist</span>
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
