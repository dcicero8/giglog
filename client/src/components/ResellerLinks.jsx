import { useState } from 'react'
import { RESELLERS } from '../lib/resellers'

export default function ResellerLinks({ artist }) {
  const [warned, setWarned] = useState(false)

  const openAll = () => {
    if (!warned) {
      setWarned(true)
      if (!window.confirm(`This will open ${RESELLERS.length} tabs with ticket searches for "${artist}". Continue?`)) {
        return
      }
    }
    RESELLERS.forEach(r => window.open(r.getUrl(artist), '_blank', 'noopener,noreferrer'))
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {RESELLERS.map(r => (
        <a
          key={r.key}
          href={r.getUrl(artist)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors no-underline"
        >
          {r.name}
        </a>
      ))}
      <button
        onClick={openAll}
        className="px-2.5 py-1 text-xs font-semibold rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors border-0 cursor-pointer"
      >
        Open All
      </button>
    </div>
  )
}
