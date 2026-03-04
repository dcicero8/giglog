import ResellerLinks from './ResellerLinks'

const PRIORITY_STYLES = {
  must_see: { label: 'Must See', class: 'bg-accent/20 text-accent' },
  want_to_see: { label: 'Want to See', class: 'bg-secondary/20 text-secondary' },
  if_cheap: { label: 'If Cheap', class: 'bg-success/20 text-success' },
}

export default function WishlistCard({ item, onPromote, onEdit, onDelete }) {
  const priority = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.want_to_see

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:bg-bg-card-hover hover:border-border-hover hover:shadow-[0_0_25px_rgba(167,139,250,0.08)]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base text-text truncate">{item.artist}</h3>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button onClick={() => onEdit(item)} className="text-text-muted hover:text-text bg-transparent border-0 cursor-pointer p-1 text-sm">
            ✎
          </button>
          <button onClick={() => onDelete(item.id)} className="text-text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-1 text-sm">
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priority.class}`}>
          {priority.label}
        </span>
        {item.max_price != null && item.max_price > 0 && (
          <span className="text-sm text-success">Max: ${item.max_price.toFixed(2)}</span>
        )}
      </div>

      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-secondary hover:text-secondary/80 mb-3 truncate max-w-full">
          🔗 Tour / Tickets Page
        </a>
      )}

      {item.notes && (
        <p className="text-sm text-text-muted mb-3 line-clamp-2">{item.notes}</p>
      )}

      <div className="mb-3">
        <p className="text-xs text-text-dim mb-2 font-medium uppercase tracking-wider">Scan Prices</p>
        <ResellerLinks artist={item.artist} />
      </div>

      <div className="pt-3 border-t border-border">
        <button
          onClick={() => onPromote(item)}
          className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors border-0 cursor-pointer"
        >
          Got Tickets!
        </button>
      </div>
    </div>
  )
}
