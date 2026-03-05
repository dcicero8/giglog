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
      <div className="flex justify-center gap-6 py-8">
        {tickets.map((t) => (
          <div key={`${t.type}-${t.id}`} className="transition-transform duration-300 hover:scale-105">
            <TicketStub ticket={t} onClick={() => onTicketClick?.(t)} />
          </div>
        ))}
      </div>
    )
  }

  // ── Coverflow-style 3D carousel ──
  const getStyle = (index) => {
    let offset = index - active
    // Wrap around
    if (offset > count / 2) offset -= count
    if (offset < -count / 2) offset += count

    const absOffset = Math.abs(offset)

    // Only render visible cards (within 3 positions)
    if (absOffset > 3) {
      return { opacity: 0, pointerEvents: 'none', transform: 'scale(0)', position: 'absolute' }
    }

    // Center card: full size, flat, highest z
    // Side cards: rotated, translated sideways, scaled down, dimmed
    const rotateY = offset === 0 ? 0 : offset < 0 ? 35 : -35
    const translateX = offset * 200
    const translateZ = absOffset === 0 ? 60 : -absOffset * 80
    const scale = absOffset === 0 ? 1.05 : Math.max(0.65, 0.85 - (absOffset - 1) * 0.1)
    const opacity = absOffset === 0 ? 1 : Math.max(0.3, 0.8 - (absOffset - 1) * 0.25)
    const brightness = absOffset === 0 ? 1 : Math.max(0.5, 0.7 - (absOffset - 1) * 0.1)

    return {
      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      zIndex: 100 - absOffset * 10,
      opacity,
      filter: absOffset === 0 ? 'none' : `brightness(${brightness})`,
      transition: 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: absOffset <= 1 ? 'auto' : 'none',
      position: 'absolute',
    }
  }

  return (
    <div className="relative select-none">
      {/* 3D coverflow scene */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ perspective: 1000, perspectiveOrigin: '50% 40%', height: 260 }}
      >
        {/* Reflective shelf surface */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: 80,
            background: 'linear-gradient(to bottom, rgba(40,40,50,0.5) 0%, rgba(20,20,28,0.8) 40%, rgba(10,10,16,0.95) 100%)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '0 0 16px 16px',
          }}
        />

        {/* Faint reflection glow under center card */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 280,
            height: 40,
            background: 'radial-gradient(ellipse, rgba(255,60,100,0.08) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />

        {/* Cards container */}
        <div
          style={{
            transformStyle: 'preserve-3d',
            width: 340,
            height: 200,
            position: 'relative',
          }}
        >
          {tickets.map((ticket, i) => {
            const style = getStyle(i)
            if (style.opacity === 0 && style.pointerEvents === 'none') return null

            return (
              <div
                key={`${ticket.type}-${ticket.id}`}
                className="absolute left-0"
                style={{
                  ...style,
                  top: '50%',
                  marginTop: -75,
                  transformOrigin: 'center center',
                  backfaceVisibility: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (i === active) onTicketClick?.(ticket)
                  else setActive(i)
                }}
              >
                {/* Card with subtle shadow */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    boxShadow: i === active
                      ? '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
                      : '0 4px 16px rgba(0,0,0,0.3)',
                  }}
                >
                  <TicketStub ticket={ticket} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <button
          onClick={prev}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-text hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center text-sm"
        >
          ‹
        </button>

        {/* Dots */}
        <div className="flex gap-1.5">
          {tickets.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-2 h-2 rounded-full border-0 cursor-pointer transition-all duration-300 ${
                i === active ? 'bg-accent scale-125' : 'bg-text-muted/25 hover:bg-text-muted/50'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-text hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center text-sm"
        >
          ›
        </button>
      </div>
    </div>
  )
}
