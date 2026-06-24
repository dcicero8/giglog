import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { api } from '../lib/api'

// Color a node by how many times the artist was seen.
const FREQUENT_BLUE = '#3b82f6'
const nodeColor = (count) => (count === 3 || count === 4) ? FREQUENT_BLUE : 'var(--color-accent)'

// Force-directed "constellation" of artists, built with d3-force (same approach as the
// SocialMedia_Mapper network graph): D3 owns the simulation and mutates the SVG directly
// on each tick, so React never re-renders the thousands of elements per frame. Each circle
// is an artist sized by how many times you've seen them; lines connect artists who shared
// a show or festival. Click an artist to fan out just their shared-show neighbourhood.
export default function ArtistNetwork() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState(null) // { id, name } when drilled into one artist

  const svgRef = useRef(null)
  const simRef = useRef(null)

  useEffect(() => {
    let alive = true
    api.get('/artists/network')
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(e => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const buildGraph = useCallback(() => {
    if (!svgRef.current || !data?.nodes?.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 900
    const height = svgRef.current.clientHeight || 700

    const q = search.toLowerCase().trim()

    // Full adjacency (across the whole graph) for highlighting + ego selection
    const fullAdj = new Map()
    for (const l of data.links) {
      if (!fullAdj.has(l.source)) fullAdj.set(l.source, new Set())
      if (!fullAdj.has(l.target)) fullAdj.set(l.target, new Set())
      fullAdj.get(l.source).add(l.target)
      fullAdj.get(l.target).add(l.source)
    }

    // In focus mode, keep only the focused artist + their direct neighbours
    const focused = focus?.id && fullAdj.has(focus.id) ? focus.id : (focus?.id && data.nodes.some(n => n.id === focus.id) ? focus.id : null)
    const keep = focused ? new Set([focused, ...(fullAdj.get(focused) || [])]) : null

    const nodes = data.nodes
      .filter(n => !keep || keep.has(n.id))
      .map(n => ({ id: n.id, name: n.name, count: n.count, r: 5 + Math.sqrt(n.count) * 3.2 }))
    const byId = new Map(nodes.map(n => [n.id, n]))
    const links = data.links
      .filter(l => byId.has(l.source) && byId.has(l.target))
      .filter(l => !keep || (l.source === focused || l.target === focused))
      .map(l => ({ source: l.source, target: l.target, weight: l.weight }))

    const adj = new Map()
    for (const l of links) {
      if (!adj.has(l.source)) adj.set(l.source, new Set())
      if (!adj.has(l.target)) adj.set(l.target, new Set())
      adj.get(l.source).add(l.target)
      adj.get(l.target).add(l.source)
    }

    // Labels: everything in focus mode; only the most-seen otherwise
    const sortedCounts = nodes.map(n => n.count).sort((a, b) => b - a)
    const labelThreshold = focused ? -1 : (sortedCounts[Math.min(30, sortedCounts.length - 1)] || 2)

    if (simRef.current) simRef.current.stop()

    let sim
    if (focused) {
      const center = byId.get(focused)
      center.fx = width / 2; center.fy = height / 2
      sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(d => 90 + d.source.r + d.target.r).strength(0.5))
        .force('charge', d3.forceManyBody().strength(-380))
        .force('collide', d3.forceCollide(d => d.r + 14))
    } else {
      sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id)
          .distance(d => 46 + d.source.r + d.target.r)
          .strength(d => Math.min(0.03 + d.weight * 0.03, 0.4)))
        .force('charge', d3.forceManyBody().strength(d => -55 - d.r * 6).distanceMax(700))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.04))
        .force('collide', d3.forceCollide(d => d.r + 6).strength(0.9))
        .force('x', d3.forceX(width / 2).strength(0.015))
        .force('y', d3.forceY(height / 2).strength(0.015))
    }
    simRef.current = sim

    const g = svg.append('g')
    const zoom = d3.zoom().scaleExtent([0.05, 6]).on('zoom', e => g.attr('transform', e.transform))
    svg.call(zoom)
    // Click empty space to leave focus mode
    svg.on('click', () => { if (focused) setFocus(null) })

    // Auto-fit the laid-out graph to the frame, once per build
    let fitted = false
    const fit = () => {
      if (!nodes.length) return
      const pad = 50
      const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
      const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
      const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad
      const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1)
      const scale = Math.min(width / bw, height / bh, 4)
      const tx = width / 2 - scale * (minX + maxX) / 2
      const ty = height / 2 - scale * (minY + maxY) / 2
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }

    const link = g.append('g').attr('class', 'links')
      .selectAll('line').data(links).join('line')
      .style('stroke', 'var(--color-text-dim)')
      .style('stroke-opacity', d => Math.min(0.06 + d.weight * 0.04, 0.3))
      .style('stroke-width', d => Math.min(0.6 + d.weight * 0.4, 2.5))

    const node = g.append('g').attr('class', 'nodes')
      .selectAll('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .clickDistance(8)
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); if (!(focused && d.id === focused)) { d.fx = null; d.fy = null } }))
      .on('click', (event, d) => { event.stopPropagation(); if (focus?.id !== d.id) setFocus({ id: d.id, name: d.name }) })
      .on('mouseover', (event, d) => {
        const friends = [...(fullAdj.get(d.id) || [])].map(id => data.nodes.find(n => n.id === id)).filter(Boolean)
          .sort((a, b) => b.count - a.count)
        setTooltip({ x: event.clientX, y: event.clientY, name: d.name, count: d.count, friends: friends.map(f => f.name) })
        const nbr = adj.get(d.id) || new Set()
        link
          .style('stroke', l => (l.source.id === d.id || l.target.id === d.id) ? 'var(--color-secondary)' : 'var(--color-text-dim)')
          .style('stroke-opacity', l => (l.source.id === d.id || l.target.id === d.id) ? Math.min(0.3 + l.weight * 0.15, 0.85) : 0.02)
        node.style('opacity', n => (n.id === d.id || nbr.has(n.id)) ? 1 : 0.12)
        node.select('text').style('opacity', n => (n.id === d.id || nbr.has(n.id)) ? 1 : (n.count >= labelThreshold ? 0.15 : 0))
      })
      .on('mousemove', (event) => setTooltip(t => t ? { ...t, x: event.clientX, y: event.clientY } : t))
      .on('mouseout', () => {
        setTooltip(null)
        link.style('stroke', 'var(--color-text-dim)').style('stroke-opacity', l => Math.min(0.06 + l.weight * 0.04, 0.3))
        node.style('opacity', 1)
        node.select('text').style('opacity', n => n.count >= labelThreshold ? 1 : 0)
      })

    node.append('circle')
      .attr('r', d => d.r)
      .style('fill', d => nodeColor(d.count))
      .style('fill-opacity', 0.85)
      .style('stroke', d => d.id === focused ? 'var(--color-text)' : nodeColor(d.count))
      .style('stroke-opacity', d => d.id === focused ? 0.9 : 0.4)
      .style('stroke-width', d => d.id === focused ? 2 : 0.5)

    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => -d.r - 4)
      .style('fill', 'var(--color-text)')
      .style('font-size', d => `${Math.max(9, Math.min(d.r + 3, 15))}px`)
      .style('font-weight', d => d.count >= labelThreshold ? 600 : 400)
      .style('pointer-events', 'none')
      .style('opacity', d => d.count >= labelThreshold ? 1 : 0)

    if (q) {
      node.style('opacity', n => n.name.toLowerCase().includes(q) ? 1 : 0.1)
      node.select('text').style('opacity', n => n.name.toLowerCase().includes(q) ? 1 : 0)
    }

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })
    sim.on('end', () => { if (!fitted) { fitted = true; fit() } })

    return () => sim.stop()
  }, [data, search, focus])

  useEffect(() => {
    const cleanup = buildGraph()
    return cleanup
  }, [buildGraph])

  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(() => buildGraph())
    ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [buildGraph])

  const blankNote = data ? (data.blankActs ? `${data.blankActs} act${data.blankActs !== 1 ? 's' : ''} with no artist name (not shown)` : 'no blank-named acts') : ''

  if (loading) return <div className="h-[70vh] rounded-xl bg-bg-card border border-border animate-pulse" />
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
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {focus ? (
          <>
            <button
              onClick={() => setFocus(null)}
              className="px-3 py-1.5 text-sm rounded-lg bg-bg-input border border-border text-text hover:border-secondary cursor-pointer"
            >
              ← All artists
            </button>
            <span className="text-xs text-text-dim">
              Showing <span className="text-text font-medium">{focus.name}</span> and everyone they shared a show with · click empty space to go back
            </span>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Highlight an artist..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary w-56"
            />
            <span className="text-xs text-text-dim">
              {data.nodes.length} artists · {data.links.length.toLocaleString()} shared-show connections · {blankNote} · click an artist to fan out · scroll to zoom · drag to pan
            </span>
          </>
        )}
      </div>
      <div className="rounded-xl bg-bg-card border border-border overflow-hidden h-[70vh]">
        <svg ref={svgRef} className="w-full h-full block" />
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-bg-card border border-border rounded-lg px-3 py-2 text-sm shadow-xl max-w-xs"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <div className="font-semibold text-text">{tooltip.name} <span className="text-text-dim font-normal">· seen {tooltip.count}×</span></div>
          {/* In focus mode the neighbours are already shown as labelled nodes, so skip the redundant list */}
          {!focus && tooltip.friends.length > 0 && (
            <div className="text-text-muted text-xs mt-1">
              with {tooltip.friends.slice(0, 12).join(', ')}{tooltip.friends.length > 12 ? ` +${tooltip.friends.length - 12} more` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
