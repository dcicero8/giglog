import { useApi } from '../hooks/useApi'
import { Link, useNavigate } from 'react-router-dom'
import CountdownBadge from '../components/CountdownBadge'
import StarRating from '../components/StarRating'

export default function Dashboard() {
  const { data: stats } = useApi('/stats')
  const { data: upcoming } = useApi('/upcoming')
  const { data: concerts } = useApi('/concerts')
  const { data: wishlist } = useApi('/wishlist')
  const { data: artists } = useApi('/artists')
  const { data: venues } = useApi('/venues')
  const { data: songsData } = useApi('/songs')
  const { data: insights } = useApi('/insights')
  const navigate = useNavigate()

  const nextShows = upcoming?.slice(0, 10) || []
  const recentConcerts = concerts?.slice(0, 5) || []
  const topWishlist = wishlist?.slice(0, 3) || []
  // Posters from the most recent shows that have one (concerts come back newest-first)
  const recentPosters = (concerts || []).filter(c => c.poster_image).slice(0, 6)
  const artistsSeen = artists ? artists.filter(a => a.showCount > 0).length : null
  const venuesAttended = venues ? venues.length : null
  const songsHeard = songsData?.stats?.totalSongs ?? null
  const onThisDay = insights?.onThisDay || []
  const thisYear = new Date().getFullYear()
  const hasOnThisDay = onThisDay.length > 0

  const fmtShort = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-3xl font-heading font-bold text-text">
          <span className="text-accent">Gig</span>Log
        </h1>
        <p className="text-sm text-text-muted">Never miss a concert again</p>
      </div>

      {/* Next Up + On This Day (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Next Up — the next 10 upcoming shows */}
        <section className={hasOnThisDay ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text">Next Up</h2>
            <Link to="/upcoming" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
          </div>
          {nextShows.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
              <p className="text-text-muted text-sm">No upcoming shows yet. Add one on the <Link to="/upcoming" className="text-secondary">Upcoming</Link> page, or check your <Link to="/wishlist" className="text-secondary">wishlist</Link>.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {nextShows.map(show => (
                <button
                  key={show.id}
                  onClick={() => navigate(`/upcoming?highlight=${show.id}`)}
                  className="w-full text-left flex items-center gap-3 bg-bg-card border border-border rounded-lg p-3 hover:bg-bg-card-hover hover:border-border-hover transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm text-text truncate">{show.artist}</p>
                    <p className="text-xs text-text-muted truncate">{[show.venue, show.city].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-muted hidden sm:inline">{fmtShort(show.date)}</span>
                    <CountdownBadge date={show.date} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* On This Day — compact box beside upcoming */}
        {hasOnThisDay && (
          <section className="lg:col-span-1">
            <div className="flex items-center mb-4">
              <h2 className="text-lg font-heading font-bold text-text">📅 On This Day</h2>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 space-y-0.5">
              {onThisDay.map(s => {
                const yearsAgo = thisYear - parseInt(s.date.slice(0, 4), 10)
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/concerts?highlight=${s.id}`)}
                    className="w-full text-left block p-1.5 rounded-lg hover:bg-bg-card-hover transition-colors"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-accent font-semibold shrink-0">
                        {yearsAgo <= 0 ? 'Today' : `${yearsAgo} yr${yearsAgo !== 1 ? 's' : ''} ago`}
                      </span>
                      <span className="text-sm text-text truncate">{s.artist}</span>
                    </div>
                    <p className="text-xs text-text-muted truncate">{[s.venue, s.city].filter(Boolean).join(' · ')}</p>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* Recent show posters */}
      {recentPosters.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text">Recent Posters</h2>
            <Link to="/collection" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {recentPosters.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/concerts?highlight=${c.id}`)}
                title={`${c.artist}${c.date ? ' · ' + new Date(c.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}`}
                className="group relative block aspect-[3/4] rounded-xl overflow-hidden border border-border bg-bg-card cursor-pointer p-0"
              >
                <img
                  src={`/uploads/posters/${c.poster_image}`}
                  alt={`${c.artist} poster`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[11px] font-semibold text-white truncate">{c.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <StatCard label="Shows Attended" value={stats?.concertCount ?? '—'} to="/concerts" />
        <StatCard label="Artists Seen" value={artistsSeen ?? '—'} color="text-success" to="/artists" />
        <StatCard label="Venues Attended" value={venuesAttended ?? '—'} to="/venues" />
        <StatCard label="Songs Heard" value={songsHeard ?? '—'} color="text-warning" to="/songs" />
        <StatCard label="Upcoming" value={stats?.upcomingCount ?? '—'} color="text-secondary" to="/upcoming" />
        <StatCard label="Wishlist" value={stats?.wishlistCount ?? '—'} color="text-accent" to="/wishlist" />
      </div>

      {/* Recent Concerts */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold text-text">Recent Shows</h2>
          <Link to="/concerts" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
        </div>
        {recentConcerts.length === 0 ? (
          <p className="text-text-muted text-sm">No concerts logged yet. Start adding your show history!</p>
        ) : (
          <div className="space-y-2">
            {recentConcerts.map(c => (
              <div key={c.id} className="flex items-center gap-4 bg-bg-card border border-border rounded-lg p-3 hover:bg-bg-card-hover transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-text truncate">{c.artist}</p>
                  <p className="text-xs text-text-muted">
                    {[c.venue, c.city].filter(Boolean).join(' · ')}
                    {c.date && ` · ${new Date(c.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </p>
                </div>
                {c.rating > 0 && <StarRating rating={c.rating} readonly size="sm" />}
                {c.price > 0 && <span className="text-sm text-success shrink-0">${c.price.toFixed(0)}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Wishlist Highlights */}
      {topWishlist.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text">Wishlist</h2>
            <Link to="/wishlist" className="text-sm text-text-muted hover:text-secondary no-underline">View All →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topWishlist.map(item => (
              <div key={item.id} className="bg-bg-card border border-border rounded-xl p-4 hover:bg-bg-card-hover transition-colors">
                <h3 className="font-heading font-bold text-sm text-text truncate mb-1">{item.artist}</h3>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  item.priority === 'must_see' ? 'bg-accent/20 text-accent' :
                  item.priority === 'if_cheap' ? 'bg-success/20 text-success' :
                  'bg-secondary/20 text-secondary'
                }`}>
                  {item.priority === 'must_see' ? 'Must See' : item.priority === 'if_cheap' ? 'If Cheap' : 'Want to See'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ label, value, color = 'text-text', to }) {
  const base = 'bg-bg-card border border-border rounded-xl p-4 text-center block'
  const inner = (
    <>
      <p className={`text-2xl font-heading font-bold ${color}`}>{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={`${base} no-underline hover:bg-bg-card-hover hover:border-border-hover transition-colors`}>
        {inner}
      </Link>
    )
  }
  return <div className={base}>{inner}</div>
}
