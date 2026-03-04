import CountdownBadge from './CountdownBadge'

export default function UpcomingCard({ show, onComplete, onEdit, onDelete }) {
  const formattedDate = show.date
    ? new Date(show.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:bg-bg-card-hover hover:border-border-hover hover:shadow-[0_0_25px_rgba(167,139,250,0.08)]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base text-text truncate">{show.artist}</h3>
          <p className="text-sm text-text-muted mt-1">
            {[show.venue, show.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button onClick={() => onEdit(show)} className="text-text-muted hover:text-text bg-transparent border-0 cursor-pointer p-1 text-sm">
            ✎
          </button>
          <button onClick={() => onDelete(show.id)} className="text-text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-1 text-sm">
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-sm mb-3">
        {formattedDate && <span className="text-text-muted">{formattedDate}</span>}
        <CountdownBadge date={show.date} />
      </div>

      <div className="flex items-center flex-wrap gap-3 text-sm text-text-muted mb-3">
        {show.price != null && show.price > 0 && (
          <span className="text-success font-medium">${show.price.toFixed(2)}</span>
        )}
        {show.section && (
          <span className="text-text-dim">{show.section}</span>
        )}
        {show.last_minute === 1 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">Last-Minute</span>
        )}
      </div>

      {show.notes && (
        <p className="text-sm text-text-muted mb-3 line-clamp-2">{show.notes}</p>
      )}

      <div className="pt-3 border-t border-border">
        <button
          onClick={() => onComplete(show)}
          className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors border-0 cursor-pointer"
        >
          Move to Past ★
        </button>
      </div>
    </div>
  )
}
