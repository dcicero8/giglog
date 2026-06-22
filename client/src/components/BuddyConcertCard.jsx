import { useState } from 'react'
import StarRating from './StarRating'
import SetlistViewer from './SetlistViewer'

// Read-only concert card for a buddy's profile — shows poster/ticket art, rating,
// festival lineup and setlists, but no editing actions.
export default function BuddyConcertCard({ concert }) {
  const [openSetlist, setOpenSetlist] = useState(false)
  const [activeBand, setActiveBand] = useState(null)

  const isFestival = concert.children && concert.children.length > 0
  const formattedDate = concert.date
    ? new Date(concert.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      {/* Poster (preferred) or uploaded ticket image */}
      {concert.poster_image ? (
        <div className="bg-black flex items-center justify-center" style={{ maxHeight: '320px' }}>
          <img src={`/uploads/posters/${concert.poster_image}`} alt={`${concert.artist} poster`} className="max-w-full max-h-80 object-contain" />
        </div>
      ) : concert.ticket_image ? (
        <img src={`/uploads/tickets/${concert.ticket_image}`} alt={`${concert.artist} ticket`} className="w-full max-h-64 object-cover" />
      ) : null}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-heading font-bold text-base text-text truncate">{concert.artist}</h3>
          {concert.setlist_fm_id && !isFestival && (
            <button
              onClick={() => setOpenSetlist(o => !o)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors border-0 cursor-pointer shrink-0 ${
                openSetlist ? 'bg-secondary/30 text-secondary ring-1 ring-secondary/40' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
              }`}
            >
              {openSetlist ? 'Hide Setlist' : 'View Setlist'}
            </button>
          )}
        </div>

        <p className="text-sm text-text-muted">{[concert.venue, concert.city].filter(Boolean).join(' · ')}</p>

        <div className="flex items-center gap-3 text-sm text-text-muted mt-2">
          {formattedDate && <span>{formattedDate}</span>}
          {concert.price != null && concert.price > 0 && <span className="text-success font-medium">${concert.price.toFixed(2)}</span>}
          {concert.last_minute === 1 && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">Last-Minute</span>}
        </div>

        {!isFestival && concert.rating > 0 && (
          <div className="mt-2"><StarRating rating={concert.rating} readonly size="sm" /></div>
        )}

        {concert.notes && (
          <p className="text-sm text-text-muted mt-2 whitespace-pre-line">{concert.notes}</p>
        )}

        {/* Solo setlist */}
        {openSetlist && concert.setlist_fm_id && !isFestival && (
          <div className="mt-3 rounded-lg bg-[#f5f0e6] border border-[#d4c9a8] p-3 max-h-[400px] overflow-y-auto">
            <SetlistViewer concert={concert} />
          </div>
        )}

        {/* Festival lineup */}
        {isFestival && (
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">
              Festival · {concert.children.length} artist{concert.children.length !== 1 ? 's' : ''}
            </span>
            <div className="mt-2 space-y-0.5">
              {concert.children.map(child => (
                <div key={child.id}>
                  <button
                    onClick={() => setActiveBand(activeBand === child.id ? null : child.id)}
                    className="w-full flex items-center justify-between gap-2 text-left py-1.5 px-2 rounded-lg hover:bg-bg-card-hover transition-colors bg-transparent border-0 cursor-pointer"
                  >
                    <span className="text-sm text-text truncate">{child.artist}</span>
                    {child.setlist_fm_id && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${activeBand === child.id ? 'text-success bg-success/30' : 'text-success bg-success/10'}`}>setlist</span>
                    )}
                  </button>
                  {activeBand === child.id && child.setlist_fm_id && (
                    <div className="mx-2 mb-2 rounded-lg bg-[#f5f0e6] border border-[#d4c9a8] p-3 max-h-[360px] overflow-y-auto">
                      <SetlistViewer concert={child} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
