export default function OnDeckCard({ event, onSave }) {
  const formattedDate = event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ''

  return (
    <div className="bg-bg-card/50 border border-border/60 rounded-xl overflow-hidden transition-all duration-300 hover:bg-bg-card hover:border-border-hover hover:shadow-[0_0_25px_rgba(167,139,250,0.06)]">
      {/* Performer image */}
      {event.image && (
        <div className="h-28 overflow-hidden">
          <img
            src={event.image}
            alt={event.artist}
            className="w-full h-full object-cover opacity-70"
          />
        </div>
      )}

      <div className="p-4">
        <h3 className="font-heading font-bold text-sm text-text truncate mb-1">{event.artist}</h3>
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
