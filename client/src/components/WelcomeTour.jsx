import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal'

const KEY = 'giglog-welcomed-v1'

const STEPS = [
  { icon: '🎫', title: "Log the shows you've seen", body: 'Search setlist.fm, paste a setlist URL, or scan a ticket — GigLog fills in the venue, date, and setlist.', to: '/concerts', cta: 'Add a show' },
  { icon: '📅', title: "Track what's coming up", body: 'Save upcoming shows and tickets, and scout concerts happening near you.', to: '/upcoming', cta: 'See Upcoming' },
  { icon: '📊', title: 'Watch your stats grow', body: 'Most-seen artists, top venues, songs heard, and on-this-day memories.', to: '/stats', cta: 'View Stats' },
  { icon: '👥', title: 'Bring your friends', body: 'Connect with buddies to compare the shows you’ve been to.', to: '/buddies', cta: 'Invite buddies' },
]

// Shown once to first-time users (no shows logged yet). Dismissal is remembered per device.
export default function WelcomeTour({ isNewUser }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(KEY) } catch { return true }
  })

  const close = () => {
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  if (!isNewUser || dismissed) return null

  return (
    <Modal open={true} onClose={close} title="Welcome to GigLog 🎶">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">Your personal concert journal — a place to remember every show. Here’s how to get started:</p>
        <div className="space-y-2">
          {STEPS.map(s => (
            <Link
              key={s.to}
              to={s.to}
              onClick={close}
              className="flex items-start gap-3 p-3 rounded-xl bg-bg-card border border-border hover:border-border-hover hover:bg-bg-card-hover transition-colors no-underline"
            >
              <span className="text-xl shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">{s.title}</p>
                <p className="text-xs text-text-muted">{s.body}</p>
              </div>
              <span className="text-xs text-secondary shrink-0 mt-0.5 whitespace-nowrap">{s.cta} →</span>
            </Link>
          ))}
        </div>
        <button
          onClick={close}
          className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer"
        >
          Get Started
        </button>
      </div>
    </Modal>
  )
}
