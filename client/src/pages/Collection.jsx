import { useApi } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'
import TicketCarousel from '../components/TicketCarousel'

export default function Collection() {
  const { data: tickets } = useApi('/tickets')
  const navigate = useNavigate()

  const handleTicketClick = (ticket) => {
    navigate(ticket.type === 'past' ? '/concerts' : '/upcoming')
  }

  const pastCount = tickets?.filter(t => t.type === 'past').length ?? 0
  const upcomingCount = tickets?.filter(t => t.type === 'upcoming').length ?? 0

  return (
    <div>
      <h1 className="text-3xl font-heading font-bold text-text mb-2">
        Ticket <span className="text-accent">Collection</span>
      </h1>
      <p className="text-sm text-text-muted mb-8">
        {pastCount} past {pastCount === 1 ? 'show' : 'shows'} · {upcomingCount} upcoming
      </p>

      {tickets && tickets.length > 0 ? (
        <TicketCarousel tickets={tickets} onTicketClick={handleTicketClick} />
      ) : (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg mb-2">No tickets yet</p>
          <p className="text-sm">Add concerts or upcoming shows to start your collection.</p>
        </div>
      )}
    </div>
  )
}
