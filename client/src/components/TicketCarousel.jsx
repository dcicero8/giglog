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

  // 3D carousel for 3+ tickets
  const getStyle = (index) => {
    let offset = index - active
    // Wrap around
    if (offset > count / 2) offset -= count
    if (offset < -count / 2) offset += count

    const absOffset = Math.abs(offset)
    const clamped = Math.min(absOffset, 3)

    return {
      transform: `
        translateX(${offset * 180}px)
        translateZ(${-clamped * 120}px)
        rotateY(${-offset * 12}deg)
      `,
      zIndex: 100 - clamped,
      opacity: clamped > 2 ? 0 : 1 - clamped * 0.25,
      filter: absOffset === 0 ? 'none' : `brightness(${1 - clamped * 0.15})`,
      transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: absOffset <= 1 ? 'auto' : 'none',
    }
  }

  return (
    <div className="relative select-none">
      {/* 3D scene */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ perspective: 1200, height: 200 }}
      >
        {tickets.map((ticket, i) => (
          <div
            key={`${ticket.type}-${ticket.id}`}
            className="absolute"
            style={getStyle(i)}
            onClick={() => {
              if (i === active) onTicketClick?.(ticket)
              else setActive(i)
            }}
          >
            <TicketStub ticket={ticket} />
          </div>
        ))}
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
