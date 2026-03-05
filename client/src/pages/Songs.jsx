import { useState, useMemo } from 'react'
import { useApi } from '../hooks/useApi'

export default function Songs() {
  const { data, loading } = useApi('/songs')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all') // 'all' | 'frequency'
  const [sort, setSort] = useState('date_desc')

  const stats = data?.stats || {}
  const songs = data?.songs || []
  const songsByFrequency = data?.songsByFrequency || []

  // Filter songs by search
  const filteredSongs = useMemo(() => {
    if (!search.trim()) return songs
    const q = search.toLowerCase()
    return songs.filter(s =>
      s.song.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      (s.coverOf && s.coverOf.toLowerCase().includes(q))
    )
  }, [songs, search])

  // Sort the flat list
  const sortedSongs = useMemo(() => {
    const sorted = [...filteredSongs]
    switch (sort) {
      case 'date_asc':
        return sorted.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      case 'date_desc':
        return sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      case 'song_asc':
        return sorted.sort((a, b) => a.song.localeCompare(b.song))
      case 'artist_asc':
        return sorted.sort((a, b) => a.artist.localeCompare(b.artist))
      default:
        return sorted
    }
  }, [filteredSongs, sort])

  // Filter frequency view by search
  const filteredFrequency = useMemo(() => {
    if (!search.trim()) return songsByFrequency
    const q = search.toLowerCase()
    return songsByFrequency.filter(s =>
      s.song.toLowerCase().includes(q) ||
      s.concerts.some(c => c.artist.toLowerCase().includes(q))
    )
  }, [songsByFrequency, search])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text">Song Ledger</h1>
      </div>

      {/* Stats row */}
      {!loading && data && (
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="px-4 py-2.5 rounded-xl bg-bg-card border border-border">
            <p className="text-2xl font-bold text-text">{stats.totalSongs?.toLocaleString()}</p>
            <p className="text-[11px] text-text-dim uppercase tracking-wider">Songs Heard</p>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-bg-card border border-border">
            <p className="text-2xl font-bold text-secondary">{stats.uniqueSongs?.toLocaleString()}</p>
            <p className="text-[11px] text-text-dim uppercase tracking-wider">Unique Songs</p>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-bg-card border border-border">
            <p className="text-2xl font-bold text-text-muted">{stats.totalShows}</p>
            <p className="text-[11px] text-text-dim uppercase tracking-wider">Shows</p>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-bg-card border border-border">
            <p className="text-2xl font-bold text-warning">{stats.coverCount}</p>
            <p className="text-[11px] text-text-dim uppercase tracking-wider">Covers</p>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-bg-card border border-border">
            <p className="text-2xl font-bold text-accent">{stats.encoreCount}</p>
            <p className="text-[11px] text-text-dim uppercase tracking-wider">Encores</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search songs or artists..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary flex-1 min-w-[200px]"
        />
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => setView('all')}
            className={`px-3 py-2 text-xs font-medium border-0 cursor-pointer transition-colors ${
              view === 'all'
                ? 'bg-accent text-white'
                : 'bg-bg-input text-text-muted hover:text-text'
            }`}
          >
            All Songs
          </button>
          <button
            onClick={() => setView('frequency')}
            className={`px-3 py-2 text-xs font-medium border-0 cursor-pointer transition-colors ${
              view === 'frequency'
                ? 'bg-accent text-white'
                : 'bg-bg-input text-text-muted hover:text-text'
            }`}
          >
            By Song
          </button>
        </div>
        {view === 'all' && (
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-secondary"
          >
            <option value="date_desc">Date (Newest)</option>
            <option value="date_asc">Date (Oldest)</option>
            <option value="song_asc">Song (A–Z)</option>
            <option value="artist_asc">Artist (A–Z)</option>
          </select>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-bg-card border border-border rounded-lg p-4 animate-pulse h-16" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && songs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg mb-2">No songs yet</p>
          <p className="text-text-dim text-sm">Link setlists to your concerts and the songs will appear here.</p>
        </div>
      )}

      {/* ═══ ALL SONGS VIEW ═══ */}
      {!loading && view === 'all' && sortedSongs.length > 0 && (
        <div>
          <p className="text-xs text-text-dim mb-3">
            {filteredSongs.length === songs.length
              ? `${songs.length} song performances`
              : `${filteredSongs.length} of ${songs.length} songs`
            }
          </p>
          <div className="space-y-1">
            {sortedSongs.map((s, i) => (
              <div
                key={`${s.concertId}-${s.song}-${i}`}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-bg-card/50 border border-border/40 hover:border-border-hover hover:bg-bg-card transition-colors group"
              >
                {/* Song name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">
                    {s.song}
                  </p>
                  <p className="text-xs text-text-dim truncate">
                    {s.artist}{s.venue ? ` · ${s.venue}` : ''}{s.city ? `, ${s.city}` : ''}
                  </p>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.isCover && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-warning/15 text-warning" title={`${s.coverOf} cover`}>
                      Cover{s.coverOf ? ` · ${s.coverOf}` : ''}
                    </span>
                  )}
                  {s.isEncore && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-accent/15 text-accent">
                      Encore
                    </span>
                  )}
                  {s.isTape && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/5 text-text-dim">
                      Tape
                    </span>
                  )}
                  {s.info && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-secondary/10 text-secondary" title={s.info}>
                      {s.info.length > 20 ? s.info.slice(0, 20) + '…' : s.info}
                    </span>
                  )}
                </div>

                {/* Date */}
                <span className="text-xs text-text-dim shrink-0 w-24 text-right">
                  {formatDate(s.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ BY FREQUENCY VIEW ═══ */}
      {!loading && view === 'frequency' && filteredFrequency.length > 0 && (
        <div>
          <p className="text-xs text-text-dim mb-3">
            {filteredFrequency.length === songsByFrequency.length
              ? `${songsByFrequency.length} unique songs`
              : `${filteredFrequency.length} of ${songsByFrequency.length} unique songs`
            }
          </p>
          <div className="space-y-1">
            {filteredFrequency.map((entry) => (
              <FrequencySongRow key={entry.song} entry={entry} formatDate={formatDate} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FrequencySongRow({ entry, formatDate }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg bg-bg-card/50 border border-border/40 hover:border-border-hover transition-colors overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-transparent border-0 cursor-pointer text-left"
      >
        {/* Frequency count */}
        <span className={`text-sm font-bold w-8 text-center shrink-0 ${
          entry.count > 1 ? 'text-accent' : 'text-text-dim'
        }`}>
          {entry.count}×
        </span>

        {/* Song name */}
        <span className="flex-1 text-sm font-medium text-text truncate">
          {entry.song}
        </span>

        {/* Artists summary */}
        <span className="text-xs text-text-dim truncate max-w-[200px] shrink-0">
          {[...new Set(entry.concerts.map(c => c.artist))].join(', ')}
        </span>

        {/* Expand indicator */}
        {entry.count > 1 && (
          <span className="text-text-dim text-xs shrink-0">
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </button>

      {/* Expanded: show each concert */}
      {expanded && entry.count > 1 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <div className="space-y-1.5 ml-8">
            {entry.concerts
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
              .map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="text-text-dim w-20 shrink-0">{formatDate(c.date)}</span>
                  <span className="font-medium text-text">{c.artist}</span>
                  {c.venue && <span className="text-text-dim">· {c.venue}</span>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
