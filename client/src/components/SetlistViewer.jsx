import { useState } from 'react'
import { api } from '../lib/api'

export default function SetlistViewer({ concert, onLink }) {
  const [setlist, setSetlist] = useState(null)
  const [searchResults, setSearchResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSetlist = async () => {
    if (concert.setlist_fm_id) {
      setLoading(true)
      setError(null)
      try {
        const data = await api.get(`/setlistfm/setlist/${concert.setlist_fm_id}`)
        setSetlist(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    } else {
      searchSetlists()
    }
  }

  const searchSetlists = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ artist: concert.artist })
      if (concert.date) params.set('date', concert.date)
      const data = await api.get(`/setlistfm/search?${params}`)
      if (data.setlist) {
        setSearchResults(data.setlist)
      } else {
        setSearchResults([])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectSetlist = async (s) => {
    setSetlist(s)
    setSearchResults(null)
    if (onLink) onLink(s.id)
  }

  const renderSongs = (sets) => {
    if (!sets?.set?.length) return <p className="text-text-muted text-sm italic">No setlist data available</p>

    return sets.set.map((set, i) => (
      <div key={i} className="mb-3">
        {set.encore && (
          <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">
            Encore {set.encore > 1 ? set.encore : ''}
          </p>
        )}
        {set.name && !set.encore && (
          <p className="text-xs text-secondary font-semibold uppercase tracking-wider mb-1">{set.name || 'Main Set'}</p>
        )}
        <ol className="list-decimal list-inside text-sm text-text-muted space-y-0.5">
          {set.song?.map((song, j) => (
            <li key={j} className={song.tape ? 'opacity-50' : ''}>
              {song.name || '(unknown)'}
              {song.cover && <span className="text-text-dim text-xs ml-1">({song.cover.name} cover)</span>}
              {song.info && <span className="text-text-dim text-xs ml-1">({song.info})</span>}
            </li>
          ))}
        </ol>
      </div>
    ))
  }

  if (!setlist && !searchResults) {
    return (
      <button
        onClick={fetchSetlist}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors border-0 cursor-pointer disabled:opacity-50"
      >
        {loading ? 'Loading...' : concert.setlist_fm_id ? 'View Setlist' : 'Search Setlist'}
      </button>
    )
  }

  return (
    <div className="mt-3 p-4 rounded-lg bg-bg-input border border-border">
      {loading && <p className="text-text-muted text-sm">Searching setlist.fm...</p>}
      {error && <p className="text-accent text-sm">{error}</p>}

      {searchResults && (
        <div>
          <p className="text-xs text-text-dim mb-2 font-medium">
            {searchResults.length} setlist{searchResults.length !== 1 ? 's' : ''} found:
          </p>
          {searchResults.length === 0 && (
            <div>
              <p className="text-text-muted text-sm mb-2">No setlists found on setlist.fm</p>
              <a
                href={`https://www.setlist.fm/search?query=${encodeURIComponent(concert.artist + ' ' + (concert.date || ''))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary text-sm hover:text-secondary-hover"
              >
                Search on setlist.fm
              </a>
            </div>
          )}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.slice(0, 10).map((s) => (
              <button
                key={s.id}
                onClick={() => selectSetlist(s)}
                className="w-full text-left p-2 rounded-lg bg-bg-card hover:bg-bg-card-hover border border-border hover:border-border-hover transition-colors cursor-pointer"
              >
                <p className="text-sm font-medium text-text">{s.artist?.name}</p>
                <p className="text-xs text-text-muted">
                  {s.venue?.name}, {s.venue?.city?.name} · {s.eventDate}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {setlist && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-text">{setlist.artist?.name}</p>
              <p className="text-xs text-text-muted">
                {setlist.venue?.name}, {setlist.venue?.city?.name} · {setlist.eventDate}
                {setlist.tour?.name && ` · ${setlist.tour.name}`}
              </p>
            </div>
            {setlist.cached && (
              <span className="text-xs text-text-dim px-2 py-0.5 rounded-full bg-white/5">cached</span>
            )}
          </div>

          {renderSongs(setlist.sets)}

          {/* Attribution (required by setlist.fm ToS) */}
          <p className="text-xs text-text-dim mt-3 pt-3 border-t border-border">
            Source:{' '}
            <a
              href={setlist.url || `https://www.setlist.fm/setlist/${setlist.id}.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:text-secondary-hover"
            >
              {setlist.artist?.name} setlist on setlist.fm
            </a>
          </p>

          <button
            onClick={() => { setSetlist(null); setSearchResults(null) }}
            className="mt-2 text-xs text-text-muted hover:text-text bg-transparent border-0 cursor-pointer"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
