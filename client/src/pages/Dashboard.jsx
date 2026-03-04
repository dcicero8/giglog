import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useSetlistImport } from '../hooks/useSetlistImport'
import { api } from '../lib/api'
import { Link, useNavigate } from 'react-router-dom'
import CountdownBadge from '../components/CountdownBadge'
import StarRating from '../components/StarRating'
import SetlistUrlInput from '../components/SetlistUrlInput'
import Modal from '../components/Modal'
import TicketCarousel from '../components/TicketCarousel'
import FestivalImportModal from '../components/FestivalImportModal'

export default function Dashboard() {
  const { data: stats, refetch: refetchStats } = useApi('/stats')
  const { data: upcoming } = useApi('/upcoming')
  const { data: concerts, refetch: refetchConcerts } = useApi('/concerts')
  const { data: wishlist } = useApi('/wishlist')
  const { data: tickets } = useApi('/tickets')
  const { setlistUrl, setSetlistUrl, altSetlistUrl, setAltSetlistUrl, loading: importLoading, error: importError, setError, importUrl, importFestival } = useSetlistImport()
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [festivalData, setFestivalData] = useState(null)

  const handleImport = async () => {
    const result = await importUrl()
    if (result) {
      setForm(result)
      setModalOpen(true)
    }
  }

  const handleFestivalImport = async () => {
    const result = await importFestival()
    if (result) {
      setFestivalData(result)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    await api.post('/concerts', {
      ...form,
      price: form.price ? parseFloat(form.price) : null,
    })
    setModalOpen(false)
    setForm(null)
    refetchConcerts()
    refetchStats()
  }

  const nextShows = upcoming?.slice(0, 3) || []
  const recentConcerts = concerts?.slice(0, 5) || []
  const topWishlist = wishlist?.slice(0, 3) || []

  return (
    <div>
      <h1 className="text-3xl font-heading font-bold text-text mb-6">
        <span className="text-accent">Gig</span>Log
      </h1>

      {/* Ticket Carousel */}
      {tickets && tickets.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text">Your Collection</h2>
            <Link to="/collection" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
          </div>
          <TicketCarousel
            tickets={tickets.slice(0, 15)}
            onTicketClick={(t) => navigate(t.type === 'past' ? '/concerts' : '/upcoming')}
          />
        </section>
      )}

      {/* Quick Import */}
      <div className="mb-8">
        <SetlistUrlInput
          url={setlistUrl}
          onUrlChange={setSetlistUrl}
          altUrl={altSetlistUrl}
          onAltUrlChange={setAltSetlistUrl}
          onImport={handleImport}
          onFestivalImport={handleFestivalImport}
          loading={importLoading}
          error={importError}
          onClearError={() => setError(null)}
        />
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <StatCard label="Shows Attended" value={stats?.concertCount ?? '—'} />
        <StatCard label="Total Spent" value={stats?.totalSpent ? `$${stats.totalSpent.toFixed(0)}` : '—'} color="text-success" />
        <StatCard label="Avg Ticket" value={stats?.avgPrice ? `$${stats.avgPrice.toFixed(0)}` : '—'} />
        <StatCard label="Avg Last-Min" value={stats?.avgLastMinutePrice ? `$${stats.avgLastMinutePrice.toFixed(0)}` : '—'} color="text-warning" />
        <StatCard label="Upcoming" value={stats?.upcomingCount ?? '—'} color="text-secondary" />
        <StatCard label="Wishlist" value={stats?.wishlistCount ?? '—'} color="text-accent" />
      </div>

      {/* Next Upcoming Shows */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold text-text">Next Up</h2>
          <Link to="/upcoming" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
        </div>
        {nextShows.length === 0 ? (
          <p className="text-text-muted text-sm">No upcoming shows. Check your <Link to="/wishlist" className="text-secondary">wishlist</Link>!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {nextShows.map(show => (
              <div key={show.id} className="bg-bg-card border border-border rounded-xl p-4 hover:bg-bg-card-hover transition-colors">
                <h3 className="font-heading font-bold text-sm text-text truncate mb-1">{show.artist}</h3>
                <p className="text-xs text-text-muted mb-2">{[show.venue, show.city].filter(Boolean).join(' · ')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {show.date && new Date(show.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <CountdownBadge date={show.date} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Concerts */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold text-text">Recent Shows</h2>
          <Link to="/concerts" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
        </div>
        {recentConcerts.length === 0 ? (
          <p className="text-text-muted text-sm">No concerts logged yet. Start adding your show history!</p>
        ) : (
          <div className="space-y-2">
            {recentConcerts.map(c => (
              <div key={c.id} className="flex items-center gap-4 bg-bg-card border border-border rounded-lg p-3 hover:bg-bg-card-hover transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-text truncate">{c.artist}</p>
                  <p className="text-xs text-text-muted">
                    {[c.venue, c.city].filter(Boolean).join(' · ')}
                    {c.date && ` · ${new Date(c.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </p>
                </div>
                {c.rating > 0 && <StarRating rating={c.rating} readonly size="sm" />}
                {c.price > 0 && <span className="text-sm text-success shrink-0">${c.price.toFixed(0)}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Wishlist Highlights */}
      {topWishlist.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text">Wishlist</h2>
            <Link to="/wishlist" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topWishlist.map(item => (
              <div key={item.id} className="bg-bg-card border border-border rounded-xl p-4 hover:bg-bg-card-hover transition-colors">
                <h3 className="font-heading font-bold text-sm text-text truncate mb-1">{item.artist}</h3>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  item.priority === 'must_see' ? 'bg-accent/20 text-accent' :
                  item.priority === 'if_cheap' ? 'bg-success/20 text-success' :
                  'bg-secondary/20 text-secondary'
                }`}>
                  {item.priority === 'must_see' ? 'Must See' : item.priority === 'if_cheap' ? 'If Cheap' : 'Want to See'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Festival Import Modal */}
      {festivalData && (
        <FestivalImportModal
          data={festivalData}
          onClose={() => setFestivalData(null)}
          onComplete={() => { refetchConcerts(); refetchStats() }}
        />
      )}

      {/* Quick Import Save Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Concert">
        {form && (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Artist *</label>
              <input type="text" required value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-text-muted mb-1">Venue</label>
                <input type="text" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">City</label>
                <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-text-muted mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Price</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Rating</label>
              <StarRating rating={form.rating} onChange={r => setForm({ ...form, rating: r })} />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary resize-y" />
            </div>
            <button type="submit"
              className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer">
              Add Concert
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}

function StatCard({ label, value, color = 'text-text' }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
      <p className={`text-2xl font-heading font-bold ${color}`}>{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  )
}
