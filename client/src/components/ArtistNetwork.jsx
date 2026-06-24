import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'

// Force-directed "constellation" of artists, drawn on a <canvas> so it stays smooth
// with hundreds of nodes and thousands of edges. Each circle is an artist sized by how
// many times you've seen them; lines connect artists who shared a show or festival.
export default function ArtistNetwork() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null) // caption for the hovered artist

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const stateRef = useRef(null) // { nodes, links, adjacency }
  const viewRef = useRef({ scale: 1, cx: 0, cy: 0, w: 0, h: 0 })
  const hoverRef = useRef(null)
  const dragRef = useRef(null)
  const rafRef = useRef(null)
  const alphaRef = useRef(0)

  useEffect(() => {
    let alive = true
    api.get('/artists/network')
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(e => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const radius = (count) => 4 + Math.sqrt(count) * 3.2

  // Build the simulation + run the canvas render loop.
  useEffect(() => {
    if (!data || !data.nodes.length || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const N = data.nodes.length
    const nodes = data.nodes.map((n, i) => {
      const a = (i / N) * Math.PI * 2
      const rr = 200 + (i % 7) * 22
      return { ...n, r: radius(n.count), x: Math.cos(a) * rr, y: Math.sin(a) * rr, vx: 0, vy: 0 }
    })
    const byId = new Map(nodes.map(n => [n.id, n]))
    const links = data.links
      .map(l => ({ s: byId.get(l.source), t: byId.get(l.target), weight: l.weight }))
      .filter(l => l.s && l.t)
    const adjacency = new Map()
    for (const l of links) {
      if (!adjacency.has(l.s.id)) adjacency.set(l.s.id, new Set())
      if (!adjacency.has(l.t.id)) adjacency.set(l.t.id, new Set())
      adjacency.get(l.s.id).add(l.t.id)
      adjacency.get(l.t.id).add(l.s.id)
    }
    stateRef.current = { nodes, links, adjacency }

    // Label only the most-seen artists (plus hovered + neighbors at draw time).
    const labelThreshold = [...nodes].sort((a, b) => b.count - a.count)[Math.min(30, N - 1)]?.count || 2

    const REP = 1100      // repulsion strength
    const CUT2 = 320 * 320 // ignore repulsion beyond this (perf + stability)
    const MAXV = 40

    const step = () => {
      const a = alphaRef.current
      for (let i = 0; i < N; i++) {
        const p = nodes[i]
        for (let j = i + 1; j < N; j++) {
          const q = nodes[j]
          let dx = p.x - q.x, dy = p.y - q.y
          let d2 = dx * dx + dy * dy
          if (d2 > CUT2 || d2 === 0) { if (d2 === 0) { dx = Math.random(); dy = Math.random(); d2 = 1 } else continue }
          const d = Math.sqrt(d2)
          let f = REP / d2
          const minD = p.r + q.r + 6
          if (d < minD) f += (minD - d) * 0.6
          const ux = dx / d, uy = dy / d
          p.vx += ux * f; p.vy += uy * f
          q.vx -= ux * f; q.vy -= uy * f
        }
      }
      for (const l of links) {
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        const ideal = l.s.r + l.t.r + 30
        const f = (d - ideal) * 0.0015 * Math.min(l.weight, 5)
        const ux = dx / d, uy = dy / d
        l.s.vx += ux * f; l.s.vy += uy * f
        l.t.vx -= ux * f; l.t.vy -= uy * f
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const n of nodes) {
        n.vx += -n.x * 0.02
        n.vy += -n.y * 0.02
        n.vx *= 0.86; n.vy *= 0.86
        // clamp + NaN guard
        if (!Number.isFinite(n.vx)) n.vx = 0
        if (!Number.isFinite(n.vy)) n.vy = 0
        n.vx = Math.max(-MAXV, Math.min(MAXV, n.vx))
        n.vy = Math.max(-MAXV, Math.min(MAXV, n.vy))
        if (n !== dragRef.current) { n.x += n.vx * a; n.y += n.vy * a }
        if (!Number.isFinite(n.x)) n.x = 0
        if (!Number.isFinite(n.y)) n.y = 0
        minX = Math.min(minX, n.x - n.r); minY = Math.min(minY, n.y - n.r)
        maxX = Math.max(maxX, n.x + n.r); maxY = Math.max(maxY, n.y + n.r)
      }
      // fit-to-view transform
      const pad = 30
      const cw = viewRef.current.w, ch = viewRef.current.h
      const worldW = (maxX - minX) + pad * 2, worldH = (maxY - minY) + pad * 2
      const scale = Math.min(cw / worldW, ch / worldH) || 1
      viewRef.current.scale = scale
      viewRef.current.cx = (minX + maxX) / 2
      viewRef.current.cy = (minY + maxY) / 2
    }

    const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const cw = viewRef.current.w, ch = viewRef.current.h
      const { scale, cx, cy } = viewRef.current
      const sx = (x) => (x - cx) * scale + cw / 2
      const sy = (y) => (y - cy) * scale + ch / 2

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, cw, ch)

      const hovered = hoverRef.current
      const lit = hovered ? adjacency.get(hovered) || new Set() : null
      const accent = css('--color-accent') || '#ff3c64'
      const sec = css('--color-secondary') || '#4ade80'
      const dim = css('--color-text-dim') || '#9ca3af'
      const textc = css('--color-text') || '#e5e7eb'

      // edges
      ctx.lineWidth = 1
      if (!hovered) {
        ctx.strokeStyle = dim
        ctx.globalAlpha = 0.06
        ctx.beginPath()
        for (const l of links) { ctx.moveTo(sx(l.s.x), sy(l.s.y)); ctx.lineTo(sx(l.t.x), sy(l.t.y)) }
        ctx.stroke()
      } else {
        ctx.strokeStyle = dim; ctx.globalAlpha = 0.03
        ctx.beginPath()
        for (const l of links) { ctx.moveTo(sx(l.s.x), sy(l.s.y)); ctx.lineTo(sx(l.t.x), sy(l.t.y)) }
        ctx.stroke()
        ctx.strokeStyle = sec
        for (const l of links) {
          if (l.s.id !== hovered && l.t.id !== hovered) continue
          ctx.globalAlpha = Math.min(0.25 + l.weight * 0.15, 0.85)
          ctx.lineWidth = Math.min(0.8 + l.weight * 0.5, 3)
          ctx.beginPath(); ctx.moveTo(sx(l.s.x), sy(l.s.y)); ctx.lineTo(sx(l.t.x), sy(l.t.y)); ctx.stroke()
        }
      }

      // nodes
      for (const n of nodes) {
        const on = !hovered || n.id === hovered || (lit && lit.has(n.id))
        ctx.globalAlpha = on ? 0.9 : 0.18
        ctx.fillStyle = accent
        ctx.beginPath(); ctx.arc(sx(n.x), sy(n.y), Math.max(n.r * scale, 1.5), 0, Math.PI * 2); ctx.fill()
      }

      // labels
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      for (const n of nodes) {
        const neighbor = lit && lit.has(n.id)
        const show = n.count >= labelThreshold || n.id === hovered || neighbor
        if (!show) continue
        const big = n.count >= labelThreshold
        ctx.globalAlpha = (!hovered || n.id === hovered || neighbor) ? 1 : 0.25
        ctx.fillStyle = (n.id === hovered) ? accent : textc
        ctx.font = `${n.id === hovered ? '600 ' : big ? '600 ' : ''}${Math.max(10, Math.min(n.r * scale + 4, 15))}px Inter, system-ui, sans-serif`
        ctx.fillText(n.name, sx(n.x), sy(n.y) - Math.max(n.r * scale, 1.5) - 2)
      }
      ctx.globalAlpha = 1
      ctx.restore()
    }

    let running = true
    const loop = () => {
      if (!running) return
      if (alphaRef.current > 0.02 || dragRef.current) {
        step()
        alphaRef.current *= 0.985
        draw()
        rafRef.current = requestAnimationFrame(loop)
      } else {
        draw()
        running = false
        rafRef.current = null
      }
    }
    const wake = () => {
      if (!running) { running = true; rafRef.current = requestAnimationFrame(loop) }
    }

    // size the canvas to its container
    const resize = () => {
      const wrap = wrapRef.current
      if (!wrap) return
      const dpr = window.devicePixelRatio || 1
      const w = wrap.clientWidth, h = wrap.clientHeight
      viewRef.current.w = w; viewRef.current.h = h
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
      wake()
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)

    // interaction
    const worldAt = (e) => {
      const rect = canvas.getBoundingClientRect()
      const { scale, cx, cy, w, h } = viewRef.current
      return {
        x: cx + (e.clientX - rect.left - w / 2) / scale,
        y: cy + (e.clientY - rect.top - h / 2) / scale,
      }
    }
    const pick = (e) => {
      const p = worldAt(e)
      let best = null, bestD = Infinity
      for (const n of nodes) {
        const dx = n.x - p.x, dy = n.y - p.y
        const d = Math.sqrt(dx * dx + dy * dy)
        const hitR = Math.max(n.r, 6 / viewRef.current.scale)
        if (d < hitR && d < bestD) { best = n; bestD = d }
      }
      return best
    }
    const onMove = (e) => {
      if (dragRef.current) {
        const p = worldAt(e)
        dragRef.current.x = p.x; dragRef.current.y = p.y
        dragRef.current.vx = 0; dragRef.current.vy = 0
        wake(); return
      }
      const hit = pick(e)
      const id = hit?.id || null
      if (id !== hoverRef.current) {
        hoverRef.current = id
        canvas.style.cursor = id ? 'grab' : 'default'
        if (id) {
          const n = nodes.find(x => x.id === id)
          const friends = [...(adjacency.get(id) || [])].map(fid => byId.get(fid)).filter(Boolean)
            .sort((a, b) => b.count - a.count)
          setInfo({ name: n.name, count: n.count, friends: friends.map(f => f.name) })
        } else setInfo(null)
        if (alphaRef.current <= 0.02 && !dragRef.current) draw() // redraw highlight when settled
        else wake()
      }
    }
    const onDown = (e) => {
      const hit = pick(e)
      if (hit) { dragRef.current = hit; canvas.style.cursor = 'grabbing'; alphaRef.current = Math.max(alphaRef.current, 0.15); wake() }
    }
    const onUp = () => { if (dragRef.current) { dragRef.current = null; canvas.style.cursor = 'grab' } }
    const onLeave = () => { hoverRef.current = null; setInfo(null); if (alphaRef.current <= 0.02) draw() }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('mouseleave', onLeave)

    alphaRef.current = 1
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const blankNote = useMemo(() => {
    if (!data) return null
    if (!data.blankActs) return 'no blank-named acts'
    return `${data.blankActs} act${data.blankActs !== 1 ? 's' : ''} with no artist name (not shown)`
  }, [data])

  if (loading) return <div className="h-[68vh] rounded-xl bg-bg-card border border-border animate-pulse" />
  if (error) return <div className="text-center py-16 text-accent text-sm">Couldn’t load the artist network: {error}</div>
  if (!data || data.nodes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted text-lg mb-2">No artists to map yet</p>
        <p className="text-text-dim text-sm">Log some shows and they’ll appear here as a constellation.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-text-dim mb-3">
        {data.nodes.length} artists · {data.links.length.toLocaleString()} shared-show connections · {blankNote} ·
        bigger circle = seen more · hover to trace who you saw together · drag to rearrange
      </p>
      <div ref={wrapRef} className="rounded-xl bg-bg-card border border-border overflow-hidden h-[68vh]">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
      <div className="mt-3 text-xs text-text-muted min-h-[1.25rem]">
        {info && (
          <>
            <span className="font-semibold text-text">{info.name}</span> — seen {info.count}×
            {info.friends.length > 0 && (
              <span> · shared a bill with {info.friends.slice(0, 10).join(', ')}{info.friends.length > 10 ? ` +${info.friends.length - 10} more` : ''}</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
