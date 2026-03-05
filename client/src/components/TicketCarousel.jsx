import { useState, useEffect, useCallback } from 'react'
import TicketStub from './TicketStub'

export default function TicketCarousel({ tickets, onTicketClick }) {
  const [active, setActive] = useState(0)
  const count = tickets.length

  const prev = useCallback(() => setActive(i => (i - 1 + count) % count), [count])
  const next = useCallback(() => setActive(i => (i + 1) % count), [count])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [prev, next])

  if (count === 0) {
    return (
      <div className="text-center py-12 text-text-muted text-sm">
        No tickets yet. Add some concerts to see your collection!
      </div>
    )
  }

  // For 1-2 tickets, show a simpler layout
  if (count <= 2) {
    return (
      <div className="flex justify-center gap-4 py-6">
        {tickets.map((t, i) => (
          <div key={`${t.type}-${t.id}`} className="transition-transform duration-300 hover:scale-105">
            <TicketStub ticket={t} onClick={() => onTicketClick?.(t)} />
          </div>
        ))}
      </div>
    )
  }

  // Cylindrical carousel for 3+ tickets
  // Radius scales with ticket count so cards don't overlap
  const radius = Math.max(320, count * 45)

  const getStyle = (index) => {
    let offset = index - active
    // Wrap around for circular positioning
    if (offset > count / 2) offset -= count
    if (offset < -count / 2) offset += count

    const angle = (offset / count) * 360 // degrees around the cylinder
    const angleRad = (angle * Math.PI) / 180
    const cosAngle = Math.cos(angleRad)
    const absOffset = Math.abs(offset)

    return {
      transform: `
        rotateY(${angle}deg)
        translateZ(${radius}px)
      `,
      zIndex: Math.round(100 + 100 * cosAngle),
      opacity: cosAngle < -0.2 ? 0 : Math.max(0.15, (cosAngle + 0.2) / 1.2),
      filter: absOffset === 0 ? 'none' : `brightness(${Math.max(0.45, 0.4 + cosAngle * 0.6)})`,
      transition: 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: absOffset <= 1 ? 'auto' : 'none',
    }
  }

  return (
    <div className="relative select-none">
      {/* 3D cylindrical scene */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ perspective: 900, height: 220 }}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            width: 340,
            height: 150,
            position: 'relative',
          }}
        >
          {tickets.map((ticket, i) => (
            <div
              key={`${ticket.type}-${ticket.id}`}
              className="absolute top-0 left-0"
              style={{
                ...getStyle(i),
                backfaceVisibility: 'hidden',
              }}
              onClick={() => {
                if (i === active) onTicketClick?.(ticket)
                else setActive(i)
              }}
            >
              <TicketStub ticket={ticket} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bg-card/80 border border-border text-text-muted hover:text-text hover:bg-bg-card-hover transition-colors cursor-pointer backdrop-blur-sm flex items-center justify-center text-lg z-50"
      >
        ‹
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bg-card/80 border border-border text-text-muted hover:text-text hover:bg-bg-card-hover transition-colors cursor-pointer backdrop-blur-sm flex items-center justify-center text-lg z-50"
      >
        ›
      </button>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {tickets.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-2 h-2 rounded-full border-0 cursor-pointer transition-all ${
              i === active ? 'bg-accent scale-125' : 'bg-text-muted/30 hover:bg-text-muted/50'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
