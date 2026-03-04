import { useState, useRef } from 'react'
import { api } from '../lib/api'
import { getYouTubeExactShowUrl, getYouTubeFullSetsUrl, getSpotifyArtistUrl } from '../lib/resellers'

export default function FestivalCard({ concert, onEdit, onDelete, onUpdate, aiAvailable, onViewBandSetlist, activeBandId }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reordering, setReordering] = useState(false)
  const ticketFileRef = useRef(null)

  const children = concert.children || []
  const year = concert.date ? new Date(concert.date + 'T00:00:00').getFullYear() : ''
  const formattedDate = concert.date
    ? new Date(concert.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const handleTicketUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('ticket', file)
      const res = await fetch(`/api/concerts/${concert.id}/ticket-image`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onUpdate?.({ ...concert, ticket_image: data.ticket_image, children })
    } catch (err) {
      alert('Failed to upload: ' + err.message)
    } finally {
      setUploading(false)
      if (ticketFileRef.current) ticketFileRef.current.value = ''
    }
  }

  const handleRemoveTicketImage = async () => {
    try {
      await fetch(`/api/concerts/${concert.id}/ticket-image`, { method: 'DELETE' })
      onUpdate?.({ ...concert, ticket_image: null, children })
    } catch (err) {
      alert('Failed to remove: ' + err.message)
    }
  }

  const moveChild = async (index, direction) => {
    if (reordering) return
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= children.length) return

    setReordering(true)
    try {
      const newOrder = [...children]
      const [moved] = newOrder.splice(index, 1)
      newOrder.splice(newIndex, 0, moved)
      const orderedIds = newOrder.map(c => c.id)

      await api.put(`/concerts/${concert.id}/reorder`, { orderedIds })
      onUpdate?.({ ...concert, children: newOrder.map((c, i) => ({ ...c, display_order: i })) })
    } catch (err) {
      alert('Failed to reorder: ' + err.message)
    } finally {
      setReordering(false)
    }
  }

  const handleSetlistLink = async (childId, setlistFmId) => {
    await api.put(`/concerts/${childId}`, { setlist_fm_id: setlistFmId })
    const updatedChildren = children.map(c =>
      c.id === childId ? { ...c, setlist_fm_id: setlistFmId } : c
    )
    onUpdate?.({ ...concert, children: updatedChildren })
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:border-border-hover hover:shadow-[0_0_25px_rgba(255,60,100,0.08)]">
      {/* Ticket Image */}
      {concert.ticket_image && (
        <div className="relative group">
          <img
            src={`/uploads/tickets/${concert.ticket_image}`}
            alt={`${concert.artist} ticket`}
            className="w-full max-h-64 object-cover"
          />
          <button
            onClick={handleRemoveTicketImage}
            className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-black/70 text-white hover:bg-accent transition-colors border-0 cursor-pointer opacity-0 group-hover:opacity-100"
          >
            Remove
          </button>
        </div>
      )}

      {/* Festival Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-lg text-text">{concert.artist}</h3>
            <p className="text-sm text-text-muted mt-1">
              {[concert.venue, concert.city].filter(Boolean).join(' · ')}
            </p>
            {formattedDate && (
              <p className="text-sm text-text-muted mt-0.5">{formattedDate}</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button onClick={() => onEdit(concert)} className="text-text-muted hover:text-text bg-transparent border-0 cursor-pointer p-1 text-sm" title="Edit festival">
              ✎
            </button>
            <button onClick={() => onDelete(concert.id)} className="text-text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-1 text-sm" title="Delete festival">
              ✕
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-text-muted mb-3">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">
            Festival · {children.length} artist{children.length !== 1 ? 's' : ''}
          </span>
          {concert.last_minute === 1 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">Last-Minute</span>
          )}
        </div>

        {/* Upload Ticket button */}
        <div className="flex items-center gap-2 mb-4">
          <input
            ref={ticketFileRef}
            type="file"
            accept="image/*"
            onChange={handleTicketUpload}
            className="hidden"
          />
          <button
            onClick={() => ticketFileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : concert.ticket_image ? '📷 Replace Image' : '📷 Upload Ticket'}
          </button>
        </div>

        {/* Expand/Collapse Band List */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-bg-input border border-border hover:border-border-hover transition-colors cursor-pointer text-left"
        >
          <span className="text-sm font-medium text-text">
            {expanded ? '▾' : '▸'} Band Lineup ({children.length})
          </span>
          <span className="text-xs text-text-dim">
            {children.filter(c => c.setlist_fm_id).length} setlist{children.filter(c => c.setlist_fm_id).length !== 1 ? 's' : ''} available
          </span>
        </button>

        {/* Band Tree */}
        {expanded && (
          <div className="mt-2 space-y-0.5">
            {children.map((child, index) => (
              <div key={child.id}>
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-bg-card-hover transition-colors group">
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0 shrink-0">
                    <button
                      onClick={() => moveChild(index, -1)}
                      disabled={index === 0 || reordering}
                      className="text-[10px] text-text-dim hover:text-text bg-transparent border-0 cursor-pointer p-0 leading-none disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveChild(index, 1)}
                      disabled={index === children.length - 1 || reordering}
                      className="text-[10px] text-text-dim hover:text-text bg-transparent border-0 cursor-pointer p-0 leading-none disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Order number */}
                  <span className="text-xs text-text-dim w-5 text-right shrink-0">{index + 1}.</span>

                  {/* Band name */}
                  {child.setlist_fm_id ? (
                    <button
                      onClick={() => onViewBandSetlist?.(activeBandId === child.id ? null : child)}
                      className={`flex-1 text-left text-sm transition-colors bg-transparent border-0 cursor-pointer p-0 truncate font-medium ${
                        activeBandId === child.id ? 'text-accent' : 'text-text hover:text-accent'
                      }`}
                      title={activeBandId === child.id ? 'Hide setlist' : 'View setlist'}
                    >
                      {child.artist}
                    </button>
                  ) : (
                    <span className="flex-1 text-left text-sm text-text p-0 truncate font-medium">
                      {child.artist}
                    </span>
                  )}

                  {/* Setlist indicator */}
                  {child.setlist_fm_id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewBandSetlist?.(activeBandId === child.id ? null : child) }}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 border-0 cursor-pointer transition-colors font-medium ${
                        activeBandId === child.id
                          ? 'text-success bg-success/30 ring-1 ring-success/40'
                          : 'text-success bg-success/10 hover:bg-success/20'
                      }`}
                    >
                      setlist
                    </button>
                  ) : (
                    <span className="text-[10px] text-text-dim/40 px-1.5 py-0.5 rounded-full bg-white/5 shrink-0">setlist</span>
                  )}

                  {/* Quick links - visible on hover */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={getYouTubeExactShowUrl(child.artist, concert.venue, year)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 text-[10px] rounded bg-[#ff0000]/10 text-[#ff4444] hover:bg-[#ff0000]/20 transition-colors no-underline"
                      title="Search YouTube"
                    >
                      ▶
                    </a>
                    <a
                      href={getSpotifyArtistUrl(child.artist)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 text-[10px] rounded bg-[#1db954]/10 text-[#1db954] hover:bg-[#1db954]/20 transition-colors no-underline"
                      title="Search Spotify"
                    >
                      ♫
                    </a>
                  </div>
                </div>

                {/* Setlist now renders to the RIGHT via parent layout */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
