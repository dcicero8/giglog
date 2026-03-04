import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import UpcomingCard from '../components/UpcomingCard'
import StarRating from '../components/StarRating'
import Modal from '../components/Modal'

const emptyForm = { artist: '', venue: '', city: '', date: '', price: '', section: '', last_minute: false, notes: '' }

export default function Upcoming() {
  const { data: shows, loading, refetch } = useApi('/upcoming')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [completeRating, setCompleteRating] = useState(0)
  const [completeNotes, setCompleteNotes] = useState('')

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Upcoming Shows</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer"
        >
          + Add Show
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-bg-card border border-border rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : !shows?.length ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">No shows on the horizon</p>
          <p className="text-text-dim text-sm">Check your wishlist for artists to see!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shows.map(show => (
            <UpcomingCard
              key={show.id}
              show={show}
              onComplete={openComplete}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
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
