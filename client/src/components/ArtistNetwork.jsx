import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'

// Force-directed "constellation" of artists: each circle is an artist sized by how
// many times you've seen them; lines connect artists who shared a show or festival.
export default function ArtistNetwork() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hover, setHover] = useState(null)
  const [, tick] = useState(0)         // bump to re-render during simulation
  const [box, setBox] = useState({ x: 0, y: 0, w: 1000, h: 700 })

  const simNodes = useRef([])
  const simLinks = useRef([])
  const rafRef = useRef(null)
  const draggingRef = useRef(null)

  useEffect(() => {
    api.get('/artists/network')
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Adjacency for hover highlighting
  const adjacency = useMemo(() => {
    const m = new Map()
    if (!data) return m
    for (const l of data.links) {
      if (!m.has(l.source)) m.set(l.source, new Set())
      if (!m.has(l.target)) m.set(l.target, new Set())
      m.get(l.source).add(l.target)
      m.get(l.target).add(l.source)
    }
    return m
  }, [data])

  // Always label the ~24 most-seen artists; the rest reveal their name on hover.
  const labeledIds = useMemo(() => {
    const top = [...(data?.nodes || [])].sort((a, b) => b.count - a.count).slice(0, 24)
    return new Set(top.map(n => n.id))
  }, [data])

  const radius = (count) => 5 + Math.sqrt(count) * 4

  // Build and run the force simulation when data arrives.
  useEffect(() => {
    if (!data || !data.nodes.length) return
    const N = data.nodes.length
    const nodes = data.nodes.map((n, i) => {
      const a = (i / N) * Math.PI * 2
      return { ...n, r: radius(n.count), x: Math.cos(a) * 250, y: Math.sin(a) * 250, vx: 0, vy: 0 }
    })
    const byId = new Map(nodes.map(n => [n.id, n]))
    const links = data.links
      .map(l => ({ s: byId.get(l.source), t: byId.get(l.target), weight: l.weight }))
      .filter(l => l.s && l.t)
    simNodes.current = nodes
    simLinks.current = links

    let alpha = 1
    const step = () => {
      // Repulsion (every pair)
      for (let i = 0; i < N; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < N; j++) {
          const b = nodes[j]
          let dx = a.x - b.x, dy = a.y - b.y
          let d2 = dx * dx + dy * dy || 0.01
          const minD = a.r + b.r + 8
          const rep = (a.r * b.r * 14) / d2
          const d = Math.sqrt(d2)
          const ux = dx / d, uy = dy / d
          a.vx += ux * rep; a.vy += uy * rep
          b.vx -= ux * rep; b.vy -= uy * rep
          // hard separation so circles don't overlap
          if (d < minD) {
            const push = (minD - d) * 0.5
            a.vx += ux * push; a.vy += uy * push
            b.vx -= ux * push; b.vy -= uy * push
          }
        }
      }
      // Attraction along links (springs)
      for (const l of links) {
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        const ideal = l.s.r + l.t.r + 40
        const f = (d - ideal) * 0.02 * Math.min(l.weight, 4)
        const ux = dx / d, uy = dy / d
        l.s.vx += ux * f; l.s.vy += uy * f
        l.t.vx -= ux * f; l.t.vy -= uy * f
      }
      // Gravity to center + integrate with friction & cooling
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const n of nodes) {
        n.vx += -n.x * 0.012
        n.vy += -n.y * 0.012
        n.vx *= 0.82; n.vy *= 0.82
        if (n !== draggingRef.current) {
          n.x += n.vx * alpha * 2
          n.y += n.vy * alpha * 2
        }
        minX = Math.min(minX, n.x - n.r); minY = Math.min(minY, n.y - n.r)
        maxX = Math.max(maxX, n.x + n.r); maxY = Math.max(maxY, n.y + n.r)
      }
      const pad = 40
      setBox({ x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 })
      alpha *= 0.985
      tick(t => t + 1)
      if (alpha > 0.02 || draggingRef.current) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drag support — convert pointer to SVG coords and pin the node under it.
  const svgRef = useRef(null)
  const toSvg = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    return {
      x: box.x + ((e.clientX - rect.left) / rect.width) * box.w,
      y: box.y + ((e.clientY - rect.top) / rect.height) * box.h,
    }
  }
  const onDown = (node) => (e) => {
    e.preventDefault()
    draggingRef.current = node
    // Re-warm the simulation loop if it had cooled to a stop.
    if (!rafRef.current) {
      const restart = () => {
        if (draggingRef.current) { tick(t => t + 1); rafRef.current = requestAnimationFrame(restart) }
        else rafRef.current = null
      }
      rafRef.current = requestAnimationFrame(restart)
    }
  }
  useEffect(() => {
    const move = (e) => {
      if (!draggingRef.current) return
      const p = toSvg(e)
      draggingRef.current.x = p.x; draggingRef.current.y = p.y
      draggingRef.current.vx = 0; draggingRef.current.vy = 0
      tick(t => t + 1)
    }
    const up = () => { draggingRef.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [box])

  if (loading) {
    return <div className="h-[60vh] rounded-xl bg-bg-card border border-border animate-pulse" />
  }
  if (error) {
    return <div className="text-center py-16 text-accent text-sm">Couldn’t load the artist network: {error}</div>
  }
  if (!data || data.nodes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted text-lg mb-2">No artists to map yet</p>
        <p className="text-text-dim text-sm">Log some shows and they’ll appear here as a constellation.</p>
      </div>
    )
  }

  const nodes = simNodes.current
  const links = simLinks.current
  const hl = hover ? adjacency.get(hover) || new Set() : null
  const isLit = (id) => !hover || id === hover || (hl && hl.has(id))

  return (
    <div>
      <p className="text-xs text-text-dim mb-3">
        {data.nodes.length} artists · {data.links.length} shared-show connection{data.links.length !== 1 ? 's' : ''} ·
        bigger circle = seen more often · hover to trace who you saw together · drag to rearrange
      </p>
      <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          className="w-full h-[68vh] select-none"
          style={{ touchAction: 'none' }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Links */}
          {links.map((l, i) => {
            const lit = !hover || l.s.id === hover || l.t.id === hover
            return (
              <line
                key={i}
                x1={l.s.x} y1={l.s.y} x2={l.t.x} y2={l.t.y}
                stroke="currentColor"
                className={lit ? 'text-secondary' : 'text-text-dim'}
                strokeOpacity={lit ? Math.min(0.15 + l.weight * 0.12, 0.7) : 0.05}
                strokeWidth={Math.min(0.6 + l.weight * 0.5, 3)}
              />
            )
          })}
          {/* Nodes */}
          {nodes.map((n) => {
            const lit = isLit(n.id)
            const topLabel = labeledIds.has(n.id)
            const showLabel = (topLabel || n.id === hover || (hl && hl.has(n.id)))
            return (
              <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseDown={onDown(n)} style={{ cursor: 'grab' }}>
                <circle
                  cx={n.x} cy={n.y} r={n.r}
                  className={lit ? 'text-accent' : 'text-text-dim'}
                  fill="currentColor"
                  fillOpacity={lit ? 0.85 : 0.25}
                  stroke="currentColor"
                  strokeOpacity={lit ? 0.9 : 0.2}
                  strokeWidth={n.id === hover ? 2 : 0.5}
                />
                {showLabel && (
                  <text
                    x={n.x} y={n.y - n.r - 3}
                    textAnchor="middle"
                    className={lit ? 'fill-text' : 'fill-text-dim'}
                    style={{ fontSize: Math.max(9, Math.min(n.r * 1.1, 16)), pointerEvents: 'none', fontWeight: topLabel ? 600 : 400 }}
                    opacity={lit ? 1 : 0.4}
                  >
                    {n.name}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {hover && (() => {
        const n = nodes.find(x => x.id === hover)
        if (!n) return null
        const friends = [...(adjacency.get(hover) || [])]
          .map(id => nodes.find(x => x.id === id)).filter(Boolean)
          .sort((a, b) => b.count - a.count)
        return (
          <div className="mt-3 text-xs text-text-muted">
            <span className="font-semibold text-text">{n.name}</span> — seen {n.count}×
            {friends.length > 0 && (
              <span> · shared a bill with {friends.slice(0, 8).map(f => f.name).join(', ')}{friends.length > 8 ? ` +${friends.length - 8} more` : ''}</span>
            )}
          </div>
        )
      })()}
    </div>
  )
}
