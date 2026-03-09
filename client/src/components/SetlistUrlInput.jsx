import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

export default function SetlistUrlInput({ url, onUrlChange, altUrl, onAltUrlChange, onImport, onImportById, onFestivalImport, loading, error, onClearError }) {
  const [showAlt, setShowAlt] = useState(false)
  const [isFestival, setIsFestival] = useState(false)
  const [mode, setMode] = useState('search') // 'search' or 'url'

  // Search state
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState([])
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [setlists, setSetlists] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchingSetlists, setSearchingSetlists] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced artist search
  useEffect(() => {
    if (query.length < 2) {
      setArtists([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.get(`/setlistfm/artists?q=${encodeURIComponent(query)}`)
        const list = data.artist || []
        setArtists(list.slice(0, 8))
        setShowDropdown(list.length > 0)
      } catch {
        setArtists([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const selectArtist = async (artist) => {
    setSelectedArtist(artist)
    setQuery(artist.name)
    setShowDropdown(false)
    setSearchingSetlists(true)
    setSetlists([])
    try {
      const data = await api.get(`/setlistfm/search?artist=${encodeURIComponent(artist.name)}`)
      const list = data.setlist || []
      setSetlists(list.filter(s => s.sets?.set?.length > 0).slice(0, 15))
    } catch {
      setSetlists([])
    } finally {
      setSearchingSetlists(false)
    }
  }

  const selectSetlist = (setlist) => {
    onImportById?.(setlist.id)
  }

  const clearSearch = () => {
    setQuery('')
    setArtists([])
    setSelectedArtist(null)
    setSetlists([])
    setShowDropdown(false)
    onClearError?.()
  }

  const formatSetlistDate = (dateStr) => {
    if (!dateStr) return ''
    const [d, m, y] = dateStr.split('-')
    const date = new Date(`${y}-${m}-${d}T00:00:00`)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getSetlistSongCount = (setlist) => {
    let count = 0
    for (const set of (setlist.sets?.set || [])) {
      count += set.song?.length || 0
    }
    return count
  }

  return (
    <div className="p-4 bg-bg-card border border-border rounded-xl">
      {/* Mode tabs */}
      <div className="flex items-center gap-3 mb-2">
        <label className="block text-xs text-text-dim font-medium uppercase tracking-wider">
          {mode === 'search' ? 'Search setlist.fm' : 'Paste setlist.fm URL'}
        </label>
        <button
          onClick={() => { setMode(mode === 'search' ? 'url' : 'search'); onClearError?.() }}
          className="text-xs text-text-muted hover:text-secondary bg-transparent border-0 cursor-pointer transition-colors ml-auto"
        >
          {mode === 'search' ? 'or paste URL →' : '← or search by artist'}
        </button>
      </div>

      {mode === 'search' ? (
        /* ── SEARCH MODE ── */
        <div ref={dropdownRef} className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for an artist..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setSelectedArtist(null)
                  setSetlists([])
                  onClearError?.()
                }}
                onFocus={() => { if (artists.length > 0 && !selectedArtist) setShowDropdown(true) }}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim text-xs">...</div>
              )}
            </div>
            {(query || selectedArtist) && (
              <button
                onClick={clearSearch}
                className="px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text-muted hover:text-text transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            )}
          </div>

          {/* Artist dropdown */}
          {showDropdown && artists.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-bg border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {artists.map((artist, i) => (
                <button
                  key={artist.mbid || i}
                  onClick={() => selectArtist(artist)}
                  className="w-full px-3 py-2 text-left text-sm text-text hover:bg-secondary/10 transition-colors cursor-pointer border-0 border-b border-border last:border-b-0 flex items-center gap-2"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <span className="font-medium">{artist.name}</span>
                  {artist.disambiguation && (
                    <span className="text-text-dim text-xs">({artist.disambiguation})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Setlist results */}
          {selectedArtist && (
            <div className="mt-3">
              {searchingSetlists ? (
                <p className="text-xs text-text-muted">Loading setlists...</p>
              ) : setlists.length === 0 ? (
                <p className="text-xs text-text-muted">No setlists found for {selectedArtist.name}</p>
              ) : (
                <>
                  <p className="text-xs text-text-dim mb-2">
                    Recent setlists for <span className="text-text font-medium">{selectedArtist.name}</span> — tap to import
                  </p>
                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                    {setlists.map((setlist) => (
                      <button
                        key={setlist.id}
                        onClick={() => selectSetlist(setlist)}
                        disabled={loading}
                        className="w-full px-3 py-2 text-left text-sm rounded-lg bg-bg-input border border-border/50 hover:bg-secondary/10 hover:border-secondary/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3"
                      >
                        <span className="text-secondary font-mono text-xs shrink-0 w-24">
                          {formatSetlistDate(setlist.eventDate)}
                        </span>
                        <span className="text-text truncate flex-1">
                          {setlist.venue?.name || 'Unknown venue'}
                        </span>
                        <span className="text-text-dim text-xs shrink-0">
                          {setlist.venue?.city?.name}{setlist.venue?.city?.stateCode ? `, ${setlist.venue.city.stateCode}` : ''}
                        </span>
                        <span className="text-text-dim text-xs shrink-0">
                          {getSetlistSongCount(setlist)} songs
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── URL MODE (original) ── */
        <>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={isFestival ? 'Paste any artist URL from the festival...' : 'https://www.setlist.fm/setlist/...'}
              value={url}
              onChange={e => { onUrlChange(e.target.value); onClearError?.() }}
              onKeyDown={e => e.key === 'Enter' && url && !showAlt && (isFestival ? onFestivalImport?.() : onImport())}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary"
            />
            <button
              onClick={isFestival ? onFestivalImport : onImport}
              disabled={!url || loading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? 'Loading...' : isFestival ? 'Find Artists' : 'Import'}
            </button>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={isFestival}
                onChange={e => { setIsFestival(e.target.checked); if (e.target.checked) setShowAlt(false) }}
                className="accent-warning"
              />
              Festival (import all artists)
            </label>

            {!isFestival && (
              <button
                onClick={() => setShowAlt(!showAlt)}
                className="text-xs text-text-muted hover:text-secondary bg-transparent border-0 cursor-pointer transition-colors"
              >
                {showAlt ? '− Hide alternate setlist' : '+ Use setlist from a different night'}
              </button>
            )}
          </div>

          {showAlt && !isFestival && (
            <div className="mt-2">
              <label className="block text-xs text-text-dim mb-1">
                Alternate setlist URL (songs will come from this show instead)
              </label>
              <input
                type="text"
                placeholder="https://www.setlist.fm/setlist/..."
                value={altUrl || ''}
                onChange={e => { onAltUrlChange?.(e.target.value); onClearError?.() }}
                onKeyDown={e => e.key === 'Enter' && url && onImport()}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-secondary"
              />
            </div>
          )}
        </>
      )}

      {error && (
        <p className={`text-xs mt-2 ${error.includes('limit') || error.includes('429') ? 'text-warning' : 'text-accent'}`}>
          {error}
        </p>
      )}
    </div>
  )
}
