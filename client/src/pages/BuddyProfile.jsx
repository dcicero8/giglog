import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function BuddyProfile() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('concerts')

  useEffect(() => {
    api.get(`/buddies/${id}/profile`)
      .then(setProfile)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-text-muted">Loading buddy profile...</div>
  if (error) return <div className="text-red-400">Error: {error}</div>
  if (!profile) return <div className="text-text-muted">Buddy not found</div>

  const { buddy, stats, concerts, upcoming, wishlist } = profile

  const tabs = [
    { key: 'concerts', label: `Concerts (${stats.concertCount})` },
    { key: 'upcoming', label: `Upcoming (${stats.upcomingCount})` },
    { key: 'wishlist', label: `Wishlist (${stats.wishlistCount})` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/buddies" className="text-text-muted hover:text-text no-underline">&larr; Buddies</Link>
      </div>

      <div className="flex items-center gap-4">
        {buddy.avatar_url ? (
          <img src={buddy.avatar_url} alt="" className="w-16 h-16 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-2xl">
            {buddy.name?.charAt(0) || '?'}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold font-heading text-text">{buddy.name}'s Collection</h1>
          <p className="text-text-muted">{buddy.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Shows', value: stats.concertCount },
          { label: 'Upcoming', value: stats.upcomingCount },
          { label: 'Wishlist', value: stats.wishlistCount },
          { label: 'Total Spent', value: `$${Math.round(stats.totalSpent)}` },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-accent">{s.value}</div>
            <div className="text-sm text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-0 bg-transparent cursor-pointer transition-colors ${
              tab === t.key
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'concerts' && (
        <div className="space-y-2">
          {concerts.length === 0 ? (
            <p className="text-text-muted text-center py-8">No concerts yet</p>
          ) : concerts.map(c => (
            <div key={c.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-text">{c.artist}</span>
                <span className="text-text-muted ml-2 text-sm">{c.venue}{c.city ? `, ${c.city}` : ''}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-muted">
                {c.rating && <span className="text-yellow-400">{'★'.repeat(c.rating)}</span>}
                {c.date && <span>{new Date(c.date + 'T00:00:00').toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-text-muted text-center py-8">No upcoming shows</p>
          ) : upcoming.map(u => (
            <div key={u.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-text">{u.artist}</span>
                <span className="text-text-muted ml-2 text-sm">{u.venue}{u.city ? `, ${u.city}` : ''}</span>
              </div>
              <div className="text-sm text-text-muted">
                {u.date && <span>{new Date(u.date + 'T00:00:00').toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'wishlist' && (
        <div className="space-y-2">
          {wishlist.length === 0 ? (
            <p className="text-text-muted text-center py-8">No wishlist items</p>
          ) : wishlist.map(w => (
            <div key={w.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="font-medium text-text">{w.artist}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                w.priority === 'must_see' ? 'bg-red-500/20 text-red-400' :
                w.priority === 'want_to_see' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {w.priority?.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
