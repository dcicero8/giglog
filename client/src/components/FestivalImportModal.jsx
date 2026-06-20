import { useState, useEffect } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'

export default function FestivalImportModal({ data, onClose, onComplete, existingFestivalId }) {
  // Normalize to a days[] shape: festival-page imports provide data.days (multi-day);
  // the single venue+date import provides a flat data.artists / data.date.
  const days = data?.days || (data ? [{ date: data.date, artists: data.artists || [] }] : [])
  const [festivalName, setFestivalName] = useState(data?.name || data?.tour || 'Festival')
  const [dayIdx, setDayIdx] = useState(0)
  const currentDay = days[dayIdx] || { date: '', artists: [] }
  const [selected, setSelected] = useState(() => new Set(currentDay.artists.map((_, i) => i)))
  const [importing, setImporting] = useState(false)

  // Default to all of a day's artists whenever the chosen day changes
  useEffect(() => {
    setSelected(new Set((days[dayIdx]?.artists || []).map((_, i) => i)))
  }, [dayIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const isAddDay = !!existingFestivalId

  if (!data) return null

  const toggle = (idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === currentDay.artists.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(currentDay.artists.map((_, i) => i)))
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const toImport = currentDay.artists.filter((_, i) => selected.has(i))
      let parentId = existingFestivalId

      if (!isAddDay) {
        // Create festival parent entry
        const parent = await api.post('/concerts', {
          artist: festivalName,
          venue: data.venue,
          city: data.city,
          date: currentDay.date,
          price: null,
          rating: 0,
          notes: '',
          last_minute: false,
        })
        parentId = parent.id
      } else {
        // Update the existing festival's end_date if this day is later
        try {
          const existing = await api.get(`/concerts/${existingFestivalId}`)
          if (existing && currentDay.date) {
            const existingStart = existing.date
            const existingEnd = existing.end_date
            const newDate = currentDay.date
            // Expand date range if needed
            if (newDate > (existingEnd || existingStart)) {
              await api.put(`/concerts/${existingFestivalId}`, { end_date: newDate })
            } else if (newDate < existingStart) {
              await api.put(`/concerts/${existingFestivalId}`, { date: newDate, end_date: existingEnd || existingStart })
            }
          }
        } catch { /* ignore - non-critical */ }
      }

      // Get existing children count for display_order offset
      let orderOffset = 0
      if (isAddDay) {
        try {
          const existing = await api.get(`/concerts/${parentId}`)
          orderOffset = existing.children?.length || 0
        } catch { /* start from 0 */ }
      }

      // Create child entries for each selected band
      for (let i = 0; i < toImport.length; i++) {
        const artist = toImport[i]
        await api.post('/concerts', {
          artist: artist.artist,
          venue: data.venue,
          city: data.city,
          date: currentDay.date,
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
  const formattedDate = fmtDay(currentDay.date)

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
            <p className="text-sm font-medium text-warning">Adding a new day to this festival</p>
          )}
          <p className="text-xs text-text-muted">
            {data.venue} · {data.city}
          </p>
          <p className="text-xs text-text-muted">{formattedDate}</p>
          <p className="text-xs text-text-dim">
            {currentDay.artists.length} artist{currentDay.artists.length !== 1 ? 's' : ''} on this day
          </p>
        </div>

        {/* Day picker (multi-day festivals) */}
        {days.length > 1 && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-dim mb-1.5">Pick a day</label>
            <div className="flex flex-wrap gap-2">
              {days.map((d, i) => (
                <button
                  key={d.date || i}
                  onClick={() => setDayIdx(i)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    i === dayIdx
                      ? 'bg-warning/20 text-warning border-warning/40'
                      : 'bg-bg-input text-text-muted border-border hover:text-text'
                  }`}
                >
                  {fmtDay(d.date) || `Day ${i + 1}`}
                  <span className="ml-1.5 text-text-dim">({d.artists.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {data.partial && (
          <p className="text-xs text-warning">Some acts may be missing — setlist.fm's rate limit was hit while loading. Try again in a moment to fill in the rest.</p>
        )}

        {/* Select all */}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleAll}
            className="text-xs text-secondary hover:text-secondary bg-transparent border-0 cursor-pointer"
          >
            {selected.size === currentDay.artists.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-text-dim">
            {selected.size} selected
          </span>
        </div>

        {/* Artist list */}
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {currentDay.artists.map((artist, i) => (
            <label
              key={artist.setlist_fm_id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-card-hover cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() => toggle(i)}
                className="accent-secondary shrink-0"
              />
              <span className="flex-1 text-sm text-text truncate">
                {artist.artist}
                {artist.tour && (
                  <span className="text-text-dim text-xs ml-1.5">{artist.tour}</span>
                )}
              </span>
              {artist.hasSongs ? (
                <span className="text-[10px] text-success px-1.5 py-0.5 rounded-full bg-success/10 shrink-0">setlist</span>
              ) : (
                <span className="text-[10px] text-text-dim px-1.5 py-0.5 rounded-full bg-white/5 shrink-0">no setlist</span>
              )}
            </label>
          ))}
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
