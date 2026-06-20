import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Insights() {
  const { data, loading } = useApi('/insights')

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-bg-card rounded animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-48 bg-bg-card border border-border rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (!data || data.totalShows === 0) {
    return (
      <div>
        <h1 className="text-2xl font-heading font-bold text-text mb-6">Stats &amp; Trends</h1>
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">No stats yet</p>
          <p className="text-text-dim text-sm">Log some shows and your trends will show up here.</p>
        </div>
      </div>
    )
  }

  const { showsByYear, showsByMonth, topArtists, topVenues, locations, totalShows } = data
  const bestYear = [...showsByYear].sort((a, b) => b.count - a.count)[0]
  const nextRound = Math.ceil((totalShows + 1) / 25) * 25

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-text mb-6">Stats &amp; Trends</h1>

      {/* Milestones */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Badge icon="🎤" label={`${totalShows} shows attended`} />
        {topArtists[0] && <Badge icon="🎸" label={`${topArtists[0].count}× ${topArtists[0].name}`} sub="most-seen artist" />}
        {topVenues[0] && <Badge icon="🏟️" label={`${topVenues[0].count}× ${topVenues[0].name}`} sub="top venue" />}
        {bestYear && <Badge icon="🔥" label={`${bestYear.year} — ${bestYear.count} shows`} sub="biggest year" />}
        <Badge icon="🌎" label={`${locations.countries} ${locations.countries === 1 ? 'country' : 'countries'} · ${locations.states} states · ${locations.cities} cities`} />
        <Badge icon="🎯" label={`${nextRound - totalShows} to your ${nextRound}th show`} />
      </div>

      {/* Shows per year */}
      <Card title="Shows per year">
        <BarChart data={showsByYear.map(d => ({ label: d.year, value: d.count }))} color="var(--color-accent)" />
      </Card>

      {/* Seasonality */}
      <Card title="When you go (by month)">
        <BarChart data={showsByMonth.map(d => ({ label: MONTHS[d.month - 1], value: d.count }))} color="var(--color-secondary)" />
      </Card>

      {/* Top artists + venues */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Most-seen artists">
          <RankList items={topArtists} to="/artists" />
        </Card>
        <Card title="Most-visited venues">
          <RankList items={topVenues} to="/venues" />
        </Card>
      </div>
    </div>
  )
}

function Badge({ icon, label, sub }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-card border border-border text-sm text-text" title={sub || ''}>
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
      {sub && <span className="text-text-dim text-xs hidden sm:inline">· {sub}</span>}
    </span>
  )
}

function Card({ title, children }) {
  return (
    <section className="bg-bg-card border border-border rounded-xl p-4 mb-4">
      <h2 className="text-sm font-heading font-bold text-text mb-4">{title}</h2>
      {children}
    </section>
  )
}

// Simple responsive vertical bar chart (SVG)
function BarChart({ data, color }) {
  const max = Math.max(1, ...data.map(d => d.value))
  const W = 100 / data.length
  return (
    <div>
      <div className="flex items-end gap-1 h-40">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
            <span className="text-[10px] text-text-muted mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.value}</span>
            <div
              className="w-full rounded-t transition-all"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? '2px' : '0', background: color, opacity: d.value > 0 ? 1 : 0.15 }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-text-dim truncate">{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// Ranked horizontal bars
function RankList({ items, to }) {
  const max = Math.max(1, ...items.map(i => i.count))
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-text-dim w-4 text-right shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0 relative h-6 rounded bg-bg-input overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded bg-secondary/25" style={{ width: `${(it.count / max) * 100}%` }} />
            <span className="absolute inset-0 flex items-center px-2 text-xs text-text truncate">{it.name}</span>
          </div>
          <span className="text-xs text-text-muted w-6 text-right shrink-0">{it.count}</span>
        </div>
      ))}
      {to && <Link to={to} className="block text-xs text-text-muted hover:text-secondary no-underline pt-1">View all →</Link>}
    </div>
  )
}
