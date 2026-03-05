import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import UpcomingCard from '../components/UpcomingCard'
import OnDeckCard from '../components/OnDeckCard'
import StarRating from '../components/StarRating'
import Modal from '../components/Modal'

const emptyForm = { artist: '', venue: '', city: '', date: '', price: '', section: '', last_minute: false, notes: '' }

export default function Upcoming() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: shows, loading, refetch } = useApi('/upcoming')
  const [highlightId, setHighlightId] = useState(null)
  const { data: wishlist } = useApi('/wishlist')
  const { data: pastArtists } = useApi('/past-artists')
  const { data: aiStatus } = useApi('/ai-status')
  const aiAvailable = aiStatus?.available ?? false
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [completeRating, setCompleteRating] = useState(0)
  const [completeNotes, setCompleteNotes] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState(null)
  const scanFileRef = useRef(null)

  // Scroll to highlighted show from carousel click
  useEffect(() => {
    const hId = searchParams.get('highlight')
    if (hId && !loading && shows?.length > 0) {
      setHighlightId(Number(hId))
      setSearchParams({}, { replace: true })
      requestAnimationFrame(() => {
        const el = document.getElementById(`upcoming-${hId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => setHighlightId(null), 2500)
        }
      })
    }
  }, [searchParams, loading, shows, setSearchParams])

  // On Deck (SeatGeek)
  const [seatgeekAvailable, setSeatgeekAvailable] = useState(false)
  const [onDeckEvents, setOnDeckEvents] = useState([])
  const [onDeckLoading, setOnDeckLoading] = useState(true)
  const [onDeckError, setOnDeckError] = useState(null)
  const [dismissedArtists, setDismissedArtists] = useState(new Set())

  useEffect(() => {
    const fetchSeatGeek = async () => {
      try {
        const status = await api.get('/seatgeek/status')
        if (!status.available) {
          setSeatgeekAvailable(false)
          setOnDeckLoading(false)
          return
        }
        setSeatgeekAvailable(true)
        const [events, dismissed] = await Promise.all([
          api.get('/seatgeek/events'),
          api.get('/dismissed-artists'),
        ])
        setOnDeckEvents(events)
        setDismissedArtists(new Set(dismissed))
      } catch (err) {
        console.error('SeatGeek fetch error:', err)
        setOnDeckError(err.message)
      } finally {
        setOnDeckLoading(false)
      }
    }
    fetchSeatGeek()
  }, [])

  const openAdd = () => {
    setForm(emptyForm)
    setEditId(null)
    setModalOpen(true)
  }

  const openEdit = (show) => {
    setForm({
      artist: show.artist || '',
      venue: show.venue || '',
      city: show.city || '',
      date: show.date || '',
      price: show.price ?? '',
      section: show.section || '',
      last_minute: !!show.last_minute,
      notes: show.notes || '',
    })
    setEditId(show.id)
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const data = {
      ...form,
      price: form.price ? parseFloat(form.price) : null,
    }
    if (editId) {
      await api.put(`/upcoming/${editId}`, data)
    } else {
      await api.post('/upcoming', data)
    }
    setModalOpen(false)
    refetch()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this show?')) return
    await api.delete(`/upcoming/${id}`)
    refetch()
  }

  const openComplete = (show) => {
    setCompleteModal(show)
    setCompleteRating(0)
    setCompleteNotes('')
  }

  const handleComplete = async () => {
    await api.post(`/upcoming/${completeModal.id}/complete`, {
      rating: completeRating,
      notes: completeNotes,
    })
    setCompleteModal(null)
    refetch()
  }

  const handleSaveOnDeck = async (event) => {
    try {
      await api.post('/upcoming', {
        artist: event.artist,
        venue: event.venue,
        city: event.city,
        date: event.date,
        price: event.lowest_price || null,
        section: '',
        last_minute: true,
        notes: `Via SeatGeek · ${event.listing_count || 0} listings available`,
      })
      refetch()
      // Remove from on deck list so user sees it moved
      setOnDeckEvents(prev => prev.filter(e => e.id !== event.id))
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  const handleDismiss = async (event) => {
    try {
      const updated = await api.post('/dismissed-artists', { artist: event.artist })
      setDismissedArtists(new Set(updated))
    } catch (err) {
      alert('Failed to dismiss: ' + err.message)
    }
  }

  const handleUndismissAll = async () => {
    if (!window.confirm(`Unhide all ${dismissedArtists.size} dismissed artists?`)) return
    try {
      for (const artist of dismissedArtists) {
        await api.delete(`/dismissed-artists/${encodeURIComponent(artist)}`)
      }
      setDismissedArtists(new Set())
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const handleScanTicket = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanLoading(true)
    setScanError(null)
    try {
      const formData = new FormData()
      formData.append('ticket', file)
      const res = await fetch('/api/parse-ticket', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to parse ticket')
      }
      const parsed = await res.json()
      setForm({
        ...emptyForm,
        artist: parsed.artist || '',
        venue: parsed.venue || '',
        city: parsed.city || '',
        date: parsed.date || '',
        price: parsed.price || '',
        section: parsed.section || '',
        notes: parsed.notes || '',
      })
      setEditId(null)
      setModalOpen(true)
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanLoading(false)
      if (scanFileRef.current) scanFileRef.current.value = ''
    }
  }

  // Build sets for matching (case-insensitive, fuzzy)
  const wishlistNames = new Set((wishlist || []).map(w => w.artist.toLowerCase()))
  const pastArtistNames = new Set((pastArtists || []).map(a => a.toLowerCase()))

  const fuzzyMatch = (artistName, nameSet) => {
    if (!artistName) return false
    const lower = artistName.toLowerCase()
    for (const name of nameSet) {
      if (lower.includes(name) || name.includes(lower)) return true
    }
    return false
  }

  const isWishlistMatch = (artistName) => fuzzyMatch(artistName, wishlistNames)
  const isPastArtistMatch = (artistName) => fuzzyMatch(artistName, pastArtistNames)

  const visibleOnDeck = onDeckEvents
    .filter(e => !dismissedArtists.has(e.artist))
    .sort((a, b) => {
      const aWishlist = isWishlistMatch(a.artist) || isWishlistMatch(a.title)
      const bWishlist = isWishlistMatch(b.artist) || isWishlistMatch(b.title)
      const aPast = isPastArtistMatch(a.artist) || isPastArtistMatch(a.title)
      const bPast = isPastArtistMatch(b.artist) || isPastArtistMatch(b.title)
      // Priority: wishlist first, then past artists, then everything else
      const aScore = aWishlist ? 2 : aPast ? 1 : 0
      const bScore = bWishlist ? 2 : bPast ? 1 : 0
      if (aScore !== bScore) return bScore - aScore
      return 0 // preserve date order otherwise
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Upcoming Shows</h1>
        <div className="flex items-center gap-2">
          <input
            ref={scanFileRef}
            type="file"
            accept="image/*"
            onChange={handleScanTicket}
            className="hidden"
          />
          {aiAvailable && (
            <button
              onClick={() => scanFileRef.current?.click()}
              disabled={scanLoading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {scanLoading ? 'Scanning...' : '📸 Scan Ticket'}
            </button>
          )}
          <button
            onClick={openAdd}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer"
          >
            + Add Show
          </button>
        </div>
      </div>

      {/* Scan error */}
      {scanError && (
        <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${scanError.includes('quota') || scanError.includes('limit') ? 'bg-warning/10 border border-warning/20' : 'bg-accent/10 border border-accent/20'}`}>
          <span className={`text-sm ${scanError.includes('quota') || scanError.includes('limit') ? 'text-warning' : 'text-accent'}`}>{scanError}</span>
          <button onClick={() => setScanError(null)} className="text-xs text-text-dim hover:text-text bg-transparent border-0 cursor-pointer ml-3 shrink-0">Dismiss</button>
        </div>
      )}

      {/* ═══ MY TICKETS ═══ */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="text-accent">🎫</span> My Tickets
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-card border border-border rounded-xl p-5 animate-pulse h-48" />
            ))}
          </div>
        ) : !shows?.length ? (
          <div className="text-center py-10 bg-bg-card/30 border border-border/40 rounded-xl">
            <p className="text-text-muted text-base mb-1">No tickets yet</p>
            <p className="text-text-dim text-sm">Add a show or save one from On Deck below!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shows.map(show => (
              <div
                key={show.id}
                id={`upcoming-${show.id}`}
                className={`transition-all duration-700 rounded-xl ${highlightId === show.id ? 'ring-2 ring-secondary ring-offset-2 ring-offset-bg scale-[1.02]' : ''}`}
              >
              <UpcomingCard
                show={show}
                onComplete={openComplete}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ DIVIDER ═══ */}
      {seatgeekAvailable && (
        <>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg px-4 text-xs font-semibold text-text-dim uppercase tracking-widest">
                Scouting
              </span>
            </div>
          </div>

          {/* ═══ ON DECK ═══ */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <span className="text-warning">🎯</span> On Deck
                <span className="text-text-dim font-normal normal-case tracking-normal">· LA Area · Next 60 Days</span>
              </h2>
              <div className="flex items-center gap-3">
                {dismissedArtists.size > 0 && (
                  <button
                    onClick={handleUndismissAll}
                    className="text-xs text-text-dim hover:text-text-muted transition-colors bg-transparent border-0 cursor-pointer"
                  >
                    {dismissedArtists.size} hidden · Reset
                  </button>
                )}
                {visibleOnDeck.length > 0 && (
                  <span className="text-xs text-text-dim">{visibleOnDeck.length} shows</span>
                )}
              </div>
            </div>

            {onDeckLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-bg-card/50 border border-border/60 rounded-xl animate-pulse h-40" />
                ))}
              </div>
            ) : onDeckError ? (
              <div className="text-center py-10 bg-bg-card/30 border border-border/40 rounded-xl">
                <p className="text-text-muted text-sm">Couldn't load SeatGeek events</p>
                <p className="text-text-dim text-xs mt-1">{onDeckError}</p>
              </div>
            ) : visibleOnDeck.length === 0 ? (
              <div className="text-center py-10 bg-bg-card/30 border border-border/40 rounded-xl">
                <p className="text-text-muted text-sm">
                  {dismissedArtists.size > 0
                    ? `All events hidden · ${dismissedArtists.size} artist${dismissedArtists.size !== 1 ? 's' : ''} dismissed`
                    : 'No concerts found in the LA area for the next 60 days'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleOnDeck.map(event => (
                  <OnDeckCard
                    key={event.id}
                    event={event}
                    onSave={handleSaveOnDeck}
                    onDismiss={handleDismiss}
                    isWishlist={isWishlistMatch(event.artist) || isWishlistMatch(event.title)}
                    isPastArtist={isPastArtistMatch(event.artist) || isPastArtistMatch(event.title)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Show' : 'Add Upcoming Show'}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm text-text-muted mb-1">Section / Seats</label>
            <input type="text" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
              placeholder="e.g. Sec HRBALC, Row A, Seat 15" />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary resize-y" />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input type="checkbox" checked={form.last_minute} onChange={e => setForm({ ...form, last_minute: e.target.checked })} className="accent-accent" />
            Last-minute deal
          </label>
          <button type="submit" className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer">
            {editId ? 'Save Changes' : 'Add Show'}
          </button>
        </form>
      </Modal>

      {/* Complete (Move to Past) Modal */}
      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title="Move to Past">
        {completeModal && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              How was <span className="text-text font-medium">{completeModal.artist}</span>?
            </p>
            <div>
              <label className="block text-sm text-text-muted mb-2">Rating</label>
              <StarRating rating={completeRating} onChange={setCompleteRating} />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Notes</label>
              <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary resize-y"
                placeholder="How was the show?" />
            </div>
            <button onClick={handleComplete}
              className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer">
              Save to Concert History
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
