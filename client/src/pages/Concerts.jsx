import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import { useSetlistImport } from '../hooks/useSetlistImport'
import ConcertCard from '../components/ConcertCard'
import FestivalCard from '../components/FestivalCard'
import SetlistViewer from '../components/SetlistViewer'
import SetlistUrlInput from '../components/SetlistUrlInput'
import StarRating from '../components/StarRating'
import Modal from '../components/Modal'
import FestivalImportModal from '../components/FestivalImportModal'

const emptyForm = { artist: '', venue: '', city: '', date: '', end_date: '', price: '', rating: 0, notes: '', last_minute: false }

export default function Concerts() {
  const [concerts, setConcerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('date_desc')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [setlistConcert, setSetlistConcert] = useState(null)
  const [festivalBandSetlist, setFestivalBandSetlist] = useState(null) // { festivalId, child }
  const { data: aiStatus } = useApi('/ai-status')
  const aiAvailable = aiStatus?.available ?? false
  const { setlistUrl, setSetlistUrl, altSetlistUrl, setAltSetlistUrl, loading: setlistLoading, error: setlistError, setError: setSetlistError, importUrl, importFestival } = useSetlistImport()
  const [festivalData, setFestivalData] = useState(null)
  const [addDayFestivalId, setAddDayFestivalId] = useState(null) // festival ID to add a day to

  const fetchConcerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sort) params.set('sort', sort)
      if (filter !== 'all') params.set('filter', filter)
      if (search) params.set('search', search)
      const data = await api.get(`/concerts?${params}`)
      setConcerts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [sort, filter, search])

  useEffect(() => { fetchConcerts() }, [fetchConcerts])

  const openAdd = () => {
    setForm(emptyForm)
    setEditId(null)
    setModalOpen(true)
  }

  const openEdit = (concert) => {
    setForm({
      artist: concert.artist || '',
      venue: concert.venue || '',
      city: concert.city || '',
      date: concert.date || '',
      end_date: concert.end_date || '',
      price: concert.price ?? '',
      rating: concert.rating || 0,
      notes: concert.notes || '',
      last_minute: !!concert.last_minute,
      _isFestival: !!concert.children?.length,
    })
    setEditId(concert.id)
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { _isFestival, ...formFields } = form
    const data = {
      ...formFields,
      price: form.price ? parseFloat(form.price) : null,
      last_minute: form.last_minute,
      setlist_fm_id: form.setlist_fm_id || null,
      setlist_fm_url: form.setlist_fm_url || null,
      end_date: form.end_date || null,
    }
    if (editId) {
      await api.put(`/concerts/${editId}`, data)
    } else {
      await api.post('/concerts', data)
    }
    setModalOpen(false)
    fetchConcerts()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this concert?')) return
    await api.delete(`/concerts/${id}`)
    fetchConcerts()
  }

  const importFromSetlistUrl = async () => {
    const result = await importUrl()
    if (result) {
      setForm(result)
      setEditId(null)
      setModalOpen(true)
    }
  }

  const handleFestivalImport = async () => {
    const result = await importFestival()
    if (result) {
      setFestivalData(result)
    }
  }

  const handleAddDay = (festivalId) => {
    setAddDayFestivalId(festivalId)
    // Scroll to the setlist URL input
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleAddDayImport = async () => {
    const result = await importFestival()
    if (result) {
      setFestivalData(result)
    }
  }

  const handleSetlistLink = async (concertId, setlistFmId) => {
    await api.put(`/concerts/${concertId}`, { setlist_fm_id: setlistFmId })
    fetchConcerts()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Past Concerts</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer"
        >
          + Add Concert
        </button>
      </div>

      {/* Add Day banner */}
      {addDayFestivalId && (
        <div className="mb-3 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center justify-between">
          <span className="text-sm text-warning font-medium">
            Adding a day to festival — paste the setlist.fm Festival URL below and click Import Festival
          </span>
          <button
            onClick={() => setAddDayFestivalId(null)}
            className="text-xs text-text-dim hover:text-text bg-transparent border-0 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Quick add from setlist.fm URL */}
      <div className="mb-6">
        <SetlistUrlInput
          url={setlistUrl}
          onUrlChange={setSetlistUrl}
          altUrl={altSetlistUrl}
          onAltUrlChange={setAltSetlistUrl}
          onImport={importFromSetlistUrl}
          onFestivalImport={addDayFestivalId ? handleAddDayImport : handleFestivalImport}
          loading={setlistLoading}
          error={setlistError}
          onClearError={() => setSetlistError(null)}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search artist..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary w-full sm:w-auto"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
        >
          <option value="all">All Shows</option>
          <option value="last_minute">Last-Minute Only</option>
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
        >
          <option value="date_desc">Date (Newest)</option>
          <option value="date_asc">Date (Oldest)</option>
          <option value="price_desc">Price (High)</option>
          <option value="price_asc">Price (Low)</option>
          <option value="rating_desc">Rating (High)</option>
          <option value="rating_asc">Rating (Low)</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-bg-card border border-border rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : concerts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">No concerts found</p>
          <p className="text-text-dim text-sm">Start logging your show history!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {concerts.map(concert => {
            const isSetlistOpen = setlistConcert?.id === concert.id
            const isFestivalSetlistOpen = festivalBandSetlist?.festivalId === concert.id
            return (
              <div
                key={concert.id}
                className={(isSetlistOpen || isFestivalSetlistOpen) ? 'md:col-span-2 lg:col-span-2' : ''}
              >
                {concert.children?.length > 0 ? (
                  festivalBandSetlist?.festivalId === concert.id ? (
                    <div className="flex gap-4 items-stretch">
                      <div className="flex-1 min-w-0">
                        <FestivalCard
                          concert={concert}
                          onEdit={openEdit}
                          onDelete={handleDelete}
                          aiAvailable={aiAvailable}
                          onUpdate={(updated) => setConcerts(prev => prev.map(c => c.id === updated.id ? updated : c))}
                          onViewBandSetlist={(child) => {
                            if (child) setFestivalBandSetlist({ festivalId: concert.id, child })
                            else setFestivalBandSetlist(null)
                          }}
                          activeBandId={festivalBandSetlist?.child?.id}
                          onAddDay={handleAddDay}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <SetlistViewer
                          concert={festivalBandSetlist.child}
                          onLink={(setlistFmId) => handleSetlistLink(festivalBandSetlist.child.id, setlistFmId)}
                        />
                      </div>
                    </div>
                  ) : (
                    <FestivalCard
                      concert={concert}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      aiAvailable={aiAvailable}
                      onUpdate={(updated) => setConcerts(prev => prev.map(c => c.id === updated.id ? updated : c))}
                      onViewBandSetlist={(child) => {
                        if (child) setFestivalBandSetlist({ festivalId: concert.id, child })
                        else setFestivalBandSetlist(null)
                      }}
                      activeBandId={null}
                      onAddDay={handleAddDay}
                    />
                  )
                ) : isSetlistOpen ? (
                  <div className="flex gap-4 items-stretch">
                    <div className="flex-1 min-w-0">
                      <ConcertCard
                        concert={concert}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onViewSetlist={() => setSetlistConcert(null)}
                        aiAvailable={aiAvailable}
                        onUpdate={(updated) => setConcerts(prev => prev.map(c => c.id === updated.id ? updated : c))}
                        setlistOpen
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <SetlistViewer
                        concert={concert}
                        onLink={(setlistFmId) => handleSetlistLink(concert.id, setlistFmId)}
                      />
                    </div>
                  </div>
                ) : (
                  <ConcertCard
                    concert={concert}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onViewSetlist={() => setSetlistConcert(concert)}
                    aiAvailable={aiAvailable}
                    onUpdate={(updated) => setConcerts(prev => prev.map(c => c.id === updated.id ? updated : c))}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Festival Import Modal */}
      {festivalData && (
        <FestivalImportModal
          data={festivalData}
          onClose={() => { setFestivalData(null); setAddDayFestivalId(null) }}
          onComplete={() => { fetchConcerts(); setAddDayFestivalId(null) }}
          existingFestivalId={addDayFestivalId}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Concert' : 'Add Concert'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Artist *</label>
            <input
              type="text"
              required
              value={form.artist}
              onChange={e => setForm({ ...form, artist: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">Venue</label>
              <input
                type="text"
                value={form.venue}
                onChange={e => setForm({ ...form, venue: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div className={`grid gap-3 ${form._isFestival ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-sm text-text-muted mb-1">{form._isFestival ? 'Start Date' : 'Date'}</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
              />
            </div>
            {form._isFestival && (
              <div>
                <label className="block text-sm text-text-muted mb-1">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-text-muted mb-1">Price</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Rating</label>
            <StarRating rating={form.rating} onChange={r => setForm({ ...form, rating: r })} />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary resize-y"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={form.last_minute}
              onChange={e => setForm({ ...form, last_minute: e.target.checked })}
              className="accent-accent"
            />
            Last-minute deal
          </label>
          <button
            type="submit"
            className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer"
          >
            {editId ? 'Save Changes' : 'Add Concert'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
