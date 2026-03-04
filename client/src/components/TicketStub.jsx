export default function TicketStub({ ticket, onClick }) {
  const isPast = ticket.type === 'past'
  const accentColor = isPast ? '#ff3c64' : '#a78bfa'
  const accentBg = isPast ? 'rgba(255,60,100,0.15)' : 'rgba(167,139,250,0.15)'

  const formattedDate = ticket.date
    ? new Date(ticket.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const stars = ticket.rating
    ? Array.from({ length: 5 }, (_, i) => (i < ticket.rating ? '★' : '☆')).join(' ')
    : ''

  // Priority: uploaded ticket image > AI SVG > default design
  if (ticket.ticket_image) {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer select-none rounded-xl overflow-hidden"
        style={{ width: 340, height: 150 }}
      >
        <img
          src={`/uploads/tickets/${ticket.ticket_image}`}
          alt={`${ticket.artist} ticket`}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  if (ticket.ticket_art_svg) {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer select-none rounded-xl overflow-hidden"
        style={{ width: 340, height: 150 }}
        dangerouslySetInnerHTML={{ __html: ticket.ticket_art_svg }}
      />
    )
  }

  return (
    <div
      onClick={onClick}
      className="cursor-pointer select-none"
      style={{ width: 340, height: 150 }}
    >
      <div
        className="w-full h-full flex rounded-xl overflow-hidden border"
        style={{
          background: `linear-gradient(135deg, ${accentBg} 0%, rgba(15,15,25,0.95) 100%)`,
          borderColor: accentColor + '40',
        }}
      >
        {/* Main section */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          {stars && (
            <p className="text-xs tracking-wider" style={{ color: accentColor }}>{stars}</p>
          )}
          <div className="min-w-0">
            <h3
              className="font-heading font-bold text-lg leading-tight truncate"
              style={{ color: accentColor }}
            >
              {ticket.artist}
            </h3>
            <p className="text-xs text-text-muted mt-1 truncate">
              {[ticket.venue, ticket.city].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-text-muted mt-0.5">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-2">
            {ticket.last_minute === 1 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-warning">♫ Last-Minute</span>
            )}
            {!isPast && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Upcoming</span>
            )}
          </div>
        </div>

        {/* Perforated divider */}
        <div className="w-px self-stretch my-3" style={{
          borderLeft: `2px dashed ${accentColor}30`,
        }} />

        {/* Stub section */}
        <div className="w-[90px] p-3 flex flex-col items-center justify-between shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Admit</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">One</p>
          {ticket.price != null && ticket.price > 0 ? (
            <p className="text-sm font-bold" style={{ color: accentColor }}>${ticket.price.toFixed(0)}</p>
          ) : (
            <p className="text-sm font-bold text-text-muted">—</p>
          )}
          {/* Fake barcode */}
          <div className="flex gap-px items-end h-5 mt-1">
            {[3,5,2,4,6,2,5,3,4,6,2,5,3].map((h, i) => (
              <div key={i} className="bg-text-muted/40" style={{ width: 2, height: h * 2 + 4 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
