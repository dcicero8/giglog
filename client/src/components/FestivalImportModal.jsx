import { useState, useEffect, Fragment } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'

export default function FestivalImportModal({ data, onClose, onComplete, existingFestivalId }) {
  // Normalize to a days[] shape: festival-page imports provide data.days (multi-day);
  // the single venue+date import provides a flat data.artists / data.date.
  const days = data?.days || (data ? [{ date: data.date, artists: data.artists || [] }] : [])
  const multiDay = days.length > 1
  const isAddDay = !!existingFestivalId

  const [festivalName, setFestivalName] = useState(data?.name || data?.tour || 'Festival')
  // Which festival days to include — defaults to all (deselect any you didn't attend)
  const [selectedDays, setSelectedDays] = useState(() => new Set(days.map((_, i) => i)))

  // Flatten the selected days' artists (in date order), each tagged with its own date
  const sortedSelDays = [...selectedDays].sort((a, b) => a - b)
  const viewArtists = sortedSelDays.flatMap(i => days[i].artists.map(a => ({ ...a, _date: days[i].date })))
  const dayKey = sortedSelDays.join(',')

  // Default-select every act except ones setlist.fm gave us with no artist name —
  // those are flagged so they aren't imported as blank rows by accident.
  const [selected, setSelected] = useState(() => new Set(viewArtists.map((_, i) => i).filter(i => !viewArtists[i].missingArtist)))
  const [importing, setImporting] = useState(false)

  // Reset artist selection whenever the day choice changes (still skipping flagged acts)
  useEffect(() => {
    const flat = sortedSelDays.flatMap(i => days[i]?.artists || [])
    setSelected(new Set(flat.map((_, k) => k).filter(k => !flat[k].missingArtist)))
  }, [dayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null

  const toggle = (idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(selected.size === viewArtists.length ? new Set() : new Set(viewArtists.map((_, i) => i)))
  }

  const toggleDay = (i) => {
    setSelectedDays(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const toImport = viewArtists.filter((_, i) => selected.has(i))
      if (!toImport.length) return
      const dates = toImport.map(a => a._date).filter(Boolean).sort()
      const minDate = dates[0] || null
      const maxDate = dates[dates.length - 1] || minDate

      let parentId = existingFestivalId

      if (!isAddDay) {
        const parent = await api.post('/concerts', {
          artist: festivalName,
          venue: data.venue,
          city: data.city,
          date: minDate,
          end_date: maxDate && maxDate !== minDate ? maxDate : null,
          price: null,
          rating: 0,
          notes: '',
          last_minute: false,
        })
        parentId = parent.id
      } else {
        // Expand the existing festival's date range to cover whatever we're adding
        try {
          const existing = await api.get(`/concerts/${existingFestivalId}`)
          if (existing && minDate) {
            const start = existing.date
            const end = existing.end_date || existing.date
            const newStart = minDate < start ? minDate : start
            const newEnd = maxDate > end ? maxDate : end
            const patch = {}
            if (newStart !== start) patch.date = newStart
            if (newEnd !== end) patch.end_date = newEnd
            if (Object.keys(patch).length) await api.put(`/concerts/${existingFestivalId}`, patch)
          }
        } catch { /* non-critical */ }
      }

      let orderOffset = 0
      if (isAddDay) {
        try {
          const existing = await api.get(`/concerts/${parentId}`)
          orderOffset = existing.children?.length || 0
        } catch { /* start from 0 */ }
      }

      // Each child carries its own day's date, so multi-day festivals render grouped by day
      for (let i = 0; i < toImport.length; i++) {
        const artist = toImport[i]
        await api.post('/concerts', {
          artist: artist.artist,
          venue: data.venue,
          city: data.city,
          date: artist._date,
          price: null,
          rating: 0,
          notes: '',
          last_minute: false,
          setlist_fm_id: artist.hasSongs ? artist.setlist_fm_id : null,
          setlist_fm_url: artist.hasSongs ? artist.setlist_fm_url : null,
          tour_name: artist.tour || null,
          parent_concert_id: parentId,
          display_order: orderOffset + i,
        })
      }

      onComplete?.()
      onClose()
    } catch (err) {
      alert('Failed to import: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const fmtDay = (d) => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const fmtShort = (d) => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const selDates = sortedSelDays.map(i => days[i]?.date).filter(Boolean)
  const headerDate = selDates.length > 1
    ? `${fmtShort(selDates[0])} – ${fmtShort(selDates[selDates.length - 1])}`
    : fmtDay(selDates[0])
  const showDayHeaders = sortedSelDays.length > 1

  return (
    <Modal open={true} onClose={onClose} title={isAddDay ? 'Add Festival Day' : 'Festival Import'}>
      <div className="space-y-4">
        {/* Festival info */}
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg space-y-2">
          {!isAddDay && (
            <>
              <label className="block text-[10px] uppercase tracking-wider text-text-dim">Festival Name</label>
              <input
                type="text"
                value={festivalName}
                onChange={e => setFestivalName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-medium rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-warning"
              />
            </>
          )}
          {isAddDay && (
            <p className="text-sm font-medium text-warning">Adding to this festival</p>
          )}
          <p className="text-xs text-text-muted">{data.venue} · {data.city}</p>
          <p className="text-xs text-text-muted">{headerDate || '—'}</p>
          <p className="text-xs text-text-dim">
            {viewArtists.length} artist{viewArtists.length !== 1 ? 's' : ''}{showDayHeaders ? ` across ${sortedSelDays.length} days` : ''}
          </p>
        </div>

        {/* Day picker — toggle the days you attended */}
        {multiDay && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] uppercase tracking-wider text-text-dim">Which days did you go?</label>
              <button
                onClick={() => setSelectedDays(new Set(days.map((_, i) => i)))}
                className="text-[11px] text-secondary hover:text-secondary bg-transparent border-0 cursor-pointer"
              >
                Select all days
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {days.map((d, i) => {
                const on = selectedDays.has(i)
                return (
                  <button
                    key={d.date || i}
                    onClick={() => toggleDay(i)}
                    aria-pressed={on}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      on ? 'bg-warning/20 text-warning border-warning/40' : 'bg-bg-input text-text-muted border-border hover:text-text'
                    }`}
                  >
                    {on ? '✓ ' : ''}{fmtDay(d.date) || `Day ${i + 1}`}
                    <span className="ml-1.5 text-text-dim">({d.artists.length})</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {data.partial && (
          <p className="text-xs text-warning">Some acts may be missing — setlist.fm's rate limit was hit while loading. Try again in a moment to fill in the rest.</p>
        )}

        {/* Artist select-all */}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleAll}
            disabled={viewArtists.length === 0}
            className="text-xs text-secondary hover:text-secondary bg-transparent border-0 cursor-pointer disabled:opacity-40"
          >
            {selected.size === viewArtists.length && viewArtists.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-text-dim">{selected.size} selected</span>
        </div>

        {/* Artist list (grouped by day when more than one day is chosen) */}
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {viewArtists.length === 0 && (
            <p className="text-xs text-text-dim text-center py-4">Pick at least one day above.</p>
          )}
          {viewArtists.map((artist, i) => {
            const showHeader = showDayHeaders && (i === 0 || viewArtists[i - 1]._date !== artist._date)
            return (
              <Fragment key={`${artist.setlist_fm_id}-${i}`}>
                {showHeader && (
                  <div className="flex items-center gap-2 mt-2 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-warning uppercase tracking-wider">{fmtDay(artist._date)}</span>
                    <div className="flex-1 border-t border-border/40" />
                  </div>
                )}
                <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-card-hover cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="accent-secondary shrink-0"
                  />
                  <span className="flex-1 text-sm text-text truncate">
                    {artist.artist || <span className="italic text-text-dim">Unknown artist</span>}
                    {artist.tour && <span className="text-text-dim text-xs ml-1.5">{artist.tour}</span>}
                  </span>
                  {artist.missingArtist && (
                    <span className="text-[10px] text-warning px-1.5 py-0.5 rounded-full bg-warning/10 shrink-0" title="setlist.fm returned no artist name for this act">⚠ no name</span>
                  )}
                  {artist.hasSongs ? (
                    <span className="text-[10px] text-success px-1.5 py-0.5 rounded-full bg-success/10 shrink-0">setlist</span>
                  ) : (
                    <span className="text-[10px] text-text-dim px-1.5 py-0.5 rounded-full bg-white/5 shrink-0">no setlist</span>
                  )}
                </label>
              </Fragment>
            )
          })}
        </div>

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={selected.size === 0 || importing || (!isAddDay && !festivalName.trim())}
          className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing
            ? `Importing ${selected.size} artist${selected.size !== 1 ? 's' : ''}...`
            : isAddDay
              ? `Add ${selected.size} Artist${selected.size !== 1 ? 's' : ''} to Festival`
              : `Import ${selected.size} Artist${selected.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </Modal>
  )
}
