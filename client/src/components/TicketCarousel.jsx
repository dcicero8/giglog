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

  // ── Cylindrical 3D carousel with coverflow styling ──
  // Radius so cards wrap around a cylinder — scales with count
  const radius = Math.max(400, count * 50)
  const anglePerCard = 360 / count

  const getStyle = (index) => {
    let offset = index - active
    if (offset > count / 2) offset -= count
    if (offset < -count / 2) offset += count

    const angle = offset * anglePerCard
    const angleRad = (angle * Math.PI) / 180
    const cosAngle = Math.cos(angleRad)
    const absOffset = Math.abs(offset)

    // Hide cards that are behind the cylinder
    if (cosAngle < -0.3) {
      return { opacity: 0, pointerEvents: 'none', visibility: 'hidden' }
    }

    // Cylindrical transform: rotate around Y axis, then push out along Z
    const scale = absOffset === 0 ? 1.08 : 0.85 + cosAngle * 0.15
    const opacity = absOffset === 0 ? 1 : Math.max(0.2, 0.3 + cosAngle * 0.7)
    const brightness = absOffset === 0 ? 1 : Math.max(0.45, 0.4 + cosAngle * 0.6)

    return {
      transform: `rotateY(${angle}deg) translateZ(${radius}px) scale(${scale})`,
      zIndex: Math.round(100 + cosAngle * 100),
      opacity,
      filter: absOffset === 0 ? 'none' : `brightness(${brightness})`,
      transition: 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: absOffset <= 1 ? 'auto' : 'none',
    }
  }

  return (
    <div className="relative select-none">
      {/* 3D cylindrical scene */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ perspective: 900, perspectiveOrigin: '50% 45%', height: 260 }}
      >
        {/* Reflective shelf beneath */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: 70,
            background: 'linear-gradient(to bottom, rgba(40,40,50,0.4) 0%, rgba(20,20,28,0.7) 50%, rgba(10,10,16,0.9) 100%)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '0 0 16px 16px',
          }}
        />

        {/* Accent glow under active card */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 260,
            height: 30,
            background: 'radial-gradient(ellipse, rgba(255,60,100,0.07) 0%, transparent 70%)',
            filter: 'blur(10px)',
          }}
        />

        {/* Cylinder container */}
        <div
          style={{
            transformStyle: 'preserve-3d',
            width: 340,
            height: 150,
            position: 'relative',
          }}
        >
          {tickets.map((ticket, i) => {
            const style = getStyle(i)
            if (style.visibility === 'hidden') return null

            const isActive = i === active

            return (
              <div
                key={`${ticket.type}-${ticket.id}`}
                className="absolute top-0 left-0"
                style={{
                  ...style,
                  backfaceVisibility: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (isActive) onTicketClick?.(ticket)
                  else setActive(i)
                }}
              >
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    boxShadow: isActive
                      ? '0 8px 40px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.3)'
                      : '0 4px 20px rgba(0,0,0,0.4)',
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
