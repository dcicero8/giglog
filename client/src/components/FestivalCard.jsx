import { useState, useRef, useMemo } from 'react'
import { api } from '../lib/api'
import { getYouTubeExactShowUrl, getYouTubeFullSetsUrl, getSpotifyArtistUrl } from '../lib/resellers'
import StarRating from './StarRating'

export default function FestivalCard({ concert, onEdit, onDelete, onUpdate, aiAvailable, onViewBandSetlist, activeBandId, onAddDay }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [posterUploading, setPosterUploading] = useState(false)
  const [reordering, setReordering] = useState(false)
  const ticketFileRef = useRef(null)
  const posterFileRef = useRef(null)

  const children = concert.children || []
  const year = concert.date ? new Date(concert.date + 'T00:00:00').getFullYear() : ''

  // Multi-day support: check if children have different dates
  const isMultiDay = useMemo(() => {
    if (concert.end_date && concert.end_date !== concert.date) return true
    const dates = new Set(children.map(c => c.date).filter(Boolean))
    return dates.size > 1
  }, [concert, children])

  // Group children by date for multi-day display
  const groupedChildren = useMemo(() => {
    if (!isMultiDay) return null
    const groups = new Map()
    children.forEach((child, idx) => {
      const key = child.date || concert.date || 'unknown'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({ child, originalIndex: idx })
    })
    // Sort groups by date
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [isMultiDay, children, concert.date])

  // Format date range for header
  const formattedDate = useMemo(() => {
    if (!concert.date) return ''
    const startDate = new Date(concert.date + 'T00:00:00')
    if (isMultiDay) {
      const endDateStr = concert.end_date || (() => {
        const childDates = children.map(c => c.date).filter(Boolean).sort()
        return childDates[childDates.length - 1] || concert.date
      })()
      if (endDateStr && endDateStr !== concert.date) {
        const endDate = new Date(endDateStr + 'T00:00:00')
        const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' })
        const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' })
        const startDay = startDate.getDate()
        const endDay = endDate.getDate()
        const yr = startDate.getFullYear()
        if (startMonth === endMonth) {
          return `${startMonth} ${startDay}–${endDay}, ${yr}`
        }
        return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${yr}`
      }
    }
    return startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
  }, [concert.date, concert.end_date, isMultiDay, children])

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

  const handlePosterUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPosterUploading(true)
    try {
      const formData = new FormData()
      formData.append('poster', file)
      const res = await fetch(`/api/concerts/${concert.id}/poster-image`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onUpdate?.({ ...concert, poster_image: data.poster_image, children })
    } catch (err) {
      alert('Failed to upload: ' + err.message)
    } finally {
      setPosterUploading(false)
      if (posterFileRef.current) posterFileRef.current.value = ''
    }
  }

  const handleRemovePoster = async () => {
    try {
      await fetch(`/api/concerts/${concert.id}/poster-image`, { method: 'DELETE' })
      onUpdate?.({ ...concert, poster_image: null, children })
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

  const handleRating = async (newRating) => {
    try {
      await api.put(`/concerts/${concert.id}`, { rating: newRating })
      onUpdate?.({ ...concert, rating: newRating, children })
    } catch (err) {
      alert('Failed to save rating: ' + err.message)
    }
  }

  const handleSetlistLink = async (childId, setlistFmId) => {
    await api.put(`/concerts/${childId}`, { setlist_fm_id: setlistFmId })
    const updatedChildren = children.map(c =>
      c.id === childId ? { ...c, setlist_fm_id: setlistFmId } : c
    )
    onUpdate?.({ ...concert, children: updatedChildren })
  }

  const formatDayHeader = (dateStr, dayNum) => {
    const d = new Date(dateStr + 'T00:00:00')
    return `Day ${dayNum} — ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
  }

  const renderBandRow = (child, index) => (
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

        {/* Band name + tour */}
        <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
          {child.setlist_fm_id ? (
            <button
              onClick={() => onViewBandSetlist?.(activeBandId === child.id ? null : child)}
              className={`text-left text-sm transition-colors bg-transparent border-0 cursor-pointer p-0 truncate font-medium ${
                activeBandId === child.id ? 'text-accent' : 'text-text hover:text-accent'
              }`}
              title={activeBandId === child.id ? 'Hide setlist' : 'View setlist'}
            >
              {child.artist}
            </button>
          ) : (
            <span className="text-left text-sm text-text p-0 truncate font-medium">
              {child.artist}
            </span>
          )}
          {child.tour_name && (
            <span className="text-[10px] text-text-dim/60 italic shrink-0 whitespace-nowrap">
              {child.tour_name}
            </span>
          )}
        </div>

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
    </div>
  )

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:border-border-hover hover:shadow-[0_0_25px_rgba(255,60,100,0.08)]">
      {/* Poster Image */}
      {concert.poster_image && (
        <div className="relative group">
          <img
            src={`/uploads/posters/${concert.poster_image}`}
            alt={`${concert.artist} poster`}
            className="w-full max-h-72 object-cover"
          />
          <button
            onClick={handleRemovePoster}
            className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-black/70 text-white hover:bg-accent transition-colors border-0 cursor-pointer opacity-0 group-hover:opacity-100"
          >
            Remove
          </button>
        </div>
      )}

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
            <div className="mt-1">
              <StarRating rating={concert.rating || 0} onChange={handleRating} size="sm" />
            </div>
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
            {isMultiDay ? 'Multi-Day Festival' : 'Festival'} · {children.length} artist{children.length !== 1 ? 's' : ''}
          </span>
          {concert.last_minute === 1 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">Last-Minute</span>
          )}
        </div>

        {/* Upload Ticket + Poster + Add Day buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            ref={ticketFileRef}
            type="file"
            accept="image/*"
            onChange={handleTicketUpload}
            className="hidden"
          />
          <input
            ref={posterFileRef}
            type="file"
            accept="image/*"
            onChange={handlePosterUpload}
            className="hidden"
          />
          <button
            onClick={() => ticketFileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : concert.ticket_image ? '📷 Replace Ticket' : '📷 Upload Ticket'}
          </button>
          <button
            onClick={() => posterFileRef.current?.click()}
            disabled={posterUploading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {posterUploading ? 'Uploading...' : concert.poster_image ? '🎨 Replace Poster' : '🎨 Upload Poster'}
          </button>
          {onAddDay && (
            <button
              onClick={() => onAddDay(concert.id)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition-colors border-0 cursor-pointer"
            >
              + Add Day
            </button>
          )}
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
          <div className="mt-2">
            {isMultiDay && groupedChildren ? (
              // Multi-day: group by date with day headers
              groupedChildren.map(([dateStr, items], dayIdx) => (
                <div key={dateStr}>
                  <div className="flex items-center gap-2 mt-3 mb-1 px-3">
                    <span className="text-[10px] font-semibold text-warning uppercase tracking-wider">
                      {formatDayHeader(dateStr, dayIdx + 1)}
                    </span>
                    <div className="flex-1 border-t border-border/40" />
                    <span className="text-[10px] text-text-dim">{items.length} artist{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map(({ child, originalIndex }) => renderBandRow(child, originalIndex))}
                  </div>
                </div>
              ))
            ) : (
              // Single-day: flat list
              <div className="space-y-0.5">
                {children.map((child, index) => renderBandRow(child, index))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
