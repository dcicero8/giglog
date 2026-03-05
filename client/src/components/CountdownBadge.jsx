export default function CountdownBadge({ date }) {
  if (!date) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const eventDate = new Date(date + 'T00:00:00')

  // Guard against invalid or nonsensical dates
  if (isNaN(eventDate.getTime()) || eventDate.getFullYear() < 1950) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/20 text-accent">
        Bad date
      </span>
    )
  }

  const diffMs = eventDate - now
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let text, colorClass

  if (days < 0) {
    text = 'Passed'
    colorClass = 'bg-text-dim/20 text-text-dim'
  } else if (days === 0) {
    text = 'Today!'
    colorClass = 'bg-accent/20 text-accent animate-pulse'
  } else if (days === 1) {
    text = 'Tomorrow!'
    colorClass = 'bg-accent/20 text-accent'
  } else if (days <= 7) {
    text = `In ${days} days`
    colorClass = 'bg-warning/20 text-warning'
  } else if (days <= 30) {
    const weeks = Math.floor(days / 7)
    text = weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`
    colorClass = 'bg-secondary/20 text-secondary'
  } else {
    const months = Math.floor(days / 30)
    text = months === 1 ? 'In 1 month' : `In ${months} months`
    colorClass = 'bg-success/20 text-success'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      {text}
    </span>
  )
}
