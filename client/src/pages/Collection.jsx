import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'
import TicketArtSVG from '../components/TicketArtSVG'

export default function Collection() {
  const { data: tickets } = useApi('/tickets')
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all') // all, tickets, posters

  // Build collection items — each uploaded image or generated ticket is a tile
  const items = []
  if (tickets) {
    for (const t of tickets) {
      if (t.ticket_image) {
        items.push({ ...t, itemType: 'ticket_photo', src: `/uploads/tickets/${t.ticket_image}` })
      }
      if (t.ticket_art_svg) {
        items.push({ ...t, itemType: 'ticket_svg' })
      }
      if (t.poster_image) {
        items.push({ ...t, itemType: 'poster', src: `/uploads/posters/${t.poster_image}` })
      }
    }
  }

  const filtered = filter === 'all' ? items
    : filter === 'tickets' ? items.filter(i => i.itemType === 'ticket_photo' || i.itemType === 'ticket_svg')
    : items.filter(i => i.itemType === 'poster')

  const ticketCount = items.filter(i => i.itemType === 'ticket_photo' || i.itemType === 'ticket_svg').length
  const posterCount = items.filter(i => i.itemType === 'poster').length

  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  return (
    <div>
      <h1 className="text-3xl font-heading font-bold text-text mb-2">
        <span className="text-accent">Collection</span>
      </h1>
      <p className="text-sm text-text-muted mb-6">
        {ticketCount} {ticketCount === 1 ? 'ticket' : 'tickets'} · {posterCount} {posterCount === 1 ? 'poster' : 'posters'}
      </p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'tickets', 'posters'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border-0 cursor-pointer capitalize ${
              filter === f
                ? 'bg-accent/20 text-accent ring-1 ring-accent/30'
                : 'bg-white/5 text-text-muted hover:bg-white/10'
            }`}
          >
            {f === 'all' ? `All (${items.length})` : f === 'tickets' ? `Tickets (${ticketCount})` : `Posters (${posterCount})`}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {filtered.map((item, i) => (
            <div
              key={`${item.itemType}-${item.id}-${i}`}
              className="break-inside-avoid rounded-xl overflow-hidden bg-bg-card border border-border hover:border-border-hover hover:shadow-[0_0_25px_rgba(255,60,100,0.08)] transition-all duration-300 cursor-pointer group"
              onClick={() => navigate(item.type === 'past' ? '/concerts' : '/upcoming')}
            >
              {/* Image / SVG */}
              {item.itemType === 'ticket_svg' ? (
                <TicketArtSVG svg={item.ticket_art_svg} className="w-full" />
              ) : (
                <img
                  src={item.src}
                  alt={`${item.artist} ${item.itemType === 'poster' ? 'poster' : 'ticket'}`}
                  className="w-full object-cover"
                  loading="lazy"
                />
              )}

              {/* Label overlay */}
              <div className="p-3">
                <p className="font-heading font-bold text-sm text-text truncate">{item.artist}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatDate(item.date)}
                  {item.venue ? ` · ${item.venue}` : ''}
                </p>
                <span className={`inline-block mt-1.5 px-1.5 py-0.5 text-[9px] font-medium rounded uppercase tracking-wider ${
                  item.itemType === 'poster'
                    ? 'bg-accent/10 text-accent'
                    : item.itemType === 'ticket_photo'
                    ? 'bg-secondary/10 text-secondary'
                    : 'bg-white/5 text-text-dim'
                }`}>
                  {item.itemType === 'poster' ? 'Poster' : item.itemType === 'ticket_photo' ? 'Ticket' : 'Print'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg mb-2">No items yet</p>
          <p className="text-sm">Upload tickets or posters from your concert pages to build your collection.</p>
        </div>
      )}
    </div>
  )
}
