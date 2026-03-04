import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import WishlistCard from '../components/WishlistCard'
import Modal from '../components/Modal'

const emptyForm = { artist: '', priority: 'want_to_see', max_price: '', notes: '', url: '' }

export default function Wishlist() {
  const { data: items, loading, refetch } = useApi('/wishlist')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [promoteModal, setPromoteModal] = useState(null)
  const [promoteForm, setPromoteForm] = useState({ venue: '', city: '', date: '', price: '', section: '', last_minute: false, notes: '', keep_in_wishlist: false })

  const openAdd = () => {
    setForm(emptyForm)
    setEditId(null)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setForm({
      artist: item.artist || '',
      priority: item.priority || 'want_to_see',
      max_price: item.max_price ?? '',
      notes: item.notes || '',
      url: item.url || '',
    })
    setEditId(item.id)
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const data = {
      ...form,
      max_price: form.max_price ? parseFloat(form.max_price) : null,
    }
    if (editId) {
      await api.put(`/wishlist/${editId}`, data)
    } else {
      await api.post('/wishlist', data)
    }
    setModalOpen(false)
    refetch()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove from wishlist?')) return
    await api.delete(`/wishlist/${id}`)
    refetch()
  }

  const openPromote = (item) => {
    setPromoteModal(item)
    setPromoteForm({ venue: '', city: '', date: '', price: '', section: '', last_minute: false, notes: '', keep_in_wishlist: false })
  }

  const handlePromote = async (e) => {
    e.preventDefault()
    await api.post(`/wishlist/${promoteModal.id}/promote`, {
      ...promoteForm,
      price: promoteForm.price ? parseFloat(promoteForm.price) : null,
    })
    setPromoteModal(null)
    refetch()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Wishlist</h1>
        <button onClick={openAdd}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer">
          + Add Artist
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-bg-card border border-border rounded-xl p-5 animate-pulse h-56" />
          ))}
        </div>
      ) : !items?.length ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">Your wishlist is empty</p>
          <p className="text-text-dim text-sm">Add artists you want to see live!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <WishlistCard key={item.id} item={item} onPromote={openPromote} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Wishlist' : 'Add to Wishlist'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Artist *</label>
            <input type="text" required value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Priority</label>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary">
              <option value="must_see">Must See</option>
              <option value="want_to_see">Want to See</option>
              <option value="if_cheap">If Cheap</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Max Price (optional)</label>
            <input type="number" step="0.01" value={form.max_price} onChange={e => setForm({ ...form, max_price: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary resize-y" />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Tour / Tickets URL (optional)</label>
            <input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" placeholder="https://..." />
          </div>
          <button type="submit"
            className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer">
            {editId ? 'Save Changes' : 'Add to Wishlist'}
          </button>
        </form>
      </Modal>

      {/* Promote (Got Tickets!) Modal */}
      <Modal open={!!promoteModal} onClose={() => setPromoteModal(null)} title="Got Tickets!">
        {promoteModal && (
          <form onSubmit={handlePromote} className="space-y-4">
            <p className="text-sm text-text-muted">
              Adding <span className="text-text font-medium">{promoteModal.artist}</span> to upcoming shows
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-text-muted mb-1">Venue</label>
                <input type="text" value={promoteForm.venue} onChange={e => setPromoteForm({ ...promoteForm, venue: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">City</label>
                <input type="text" value={promoteForm.city} onChange={e => setPromoteForm({ ...promoteForm, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-text-muted mb-1">Date</label>
                <input type="date" value={promoteForm.date} onChange={e => setPromoteForm({ ...promoteForm, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Price</label>
                <input type="number" step="0.01" value={promoteForm.price} onChange={e => setPromoteForm({ ...promoteForm, price: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Section / Seats</label>
              <input type="text" value={promoteForm.section} onChange={e => setPromoteForm({ ...promoteForm, section: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary" />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Notes</label>
              <textarea value={promoteForm.notes} onChange={e => setPromoteForm({ ...promoteForm, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary resize-y" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input type="checkbox" checked={promoteForm.last_minute} onChange={e => setPromoteForm({ ...promoteForm, last_minute: e.target.checked })} className="accent-accent" />
                Last-minute
              </label>
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input type="checkbox" checked={promoteForm.keep_in_wishlist} onChange={e => setPromoteForm({ ...promoteForm, keep_in_wishlist: e.target.checked })} className="accent-secondary" />
                Keep in wishlist
              </label>
            </div>
            <button type="submit"
              className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-success text-bg font-bold hover:opacity-90 transition-colors border-0 cursor-pointer">
              Add to Upcoming
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}
