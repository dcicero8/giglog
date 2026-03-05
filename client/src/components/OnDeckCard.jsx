export default function OnDeckCard({ event, onSave, onDismiss, isWishlist }) {
  const formattedDate = event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ''

  return (
    <div className={`rounded-xl overflow-hidden transition-all duration-300 group ${
      isWishlist
        ? 'bg-warning/10 border-2 border-warning/50 hover:border-warning hover:shadow-[0_0_30px_rgba(251,191,36,0.15)]'
        : 'bg-bg-card/50 border border-border/60 hover:bg-bg-card hover:border-border-hover hover:shadow-[0_0_25px_rgba(167,139,250,0.06)]'
    }`}>
      {/* Performer image */}
      {event.image && (
        <div className="h-28 overflow-hidden relative">
          <img
            src={event.image}
            alt={event.artist}
            className={`w-full h-full object-cover ${isWishlist ? 'opacity-90' : 'opacity-70'}`}
          />
          {/* Dismiss button - top right of image */}
          {onDismiss && (
            <button
              onClick={() => onDismiss(event)}
              className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center text-xs rounded-full bg-black/60 text-white/70 hover:bg-accent hover:text-white transition-colors border-0 cursor-pointer opacity-0 group-hover:opacity-100"
              title={`Hide ${event.artist}`}
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="p-4">
        {isWishlist && (
          <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-warning/20 text-warning mb-2">
            ★ Wishlist
          </span>
        )}
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-heading font-bold text-sm text-text truncate mb-1">{event.artist}</h3>
          {/* Dismiss button fallback when no image */}
          {!event.image && onDismiss && (
            <button
              onClick={() => onDismiss(event)}
              className="text-text-dim/40 hover:text-accent text-xs bg-transparent border-0 cursor-pointer p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title={`Hide ${event.artist}`}
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-text-muted truncate">
          {event.venue}{event.city ? ` · ${event.city}` : ''}
        </p>

        <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
          {formattedDate && <span>{formattedDate}</span>}
          {event.time && <span className="text-text-dim">{event.time}</span>}
        </div>

        {/* Pricing */}
        <div className="flex items-center gap-2 mt-2">
          {event.lowest_price != null && (
            <span className="text-xs font-semibold text-success">
              From ${event.lowest_price}
            </span>
          )}
          {event.average_price != null && event.average_price !== event.lowest_price && (
            <span className="text-xs text-text-dim">
              Avg ${event.average_price}
            </span>
          )}
          {event.listing_count > 0 && (
            <span className="text-[10px] text-text-dim/60">
              {event.listing_count} listings
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors no-underline text-center"
          >
            Get Tickets
          </a>
          <button
            onClick={() => onSave(event)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors border-0 cursor-pointer"
            title="Save to My Tickets"
          >
            + Save
          </button>
        </div>
      </div>
    </div>
  )
}
