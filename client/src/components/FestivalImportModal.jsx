import { useState } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'

export default function FestivalImportModal({ data, onClose, onComplete }) {
  const [festivalName, setFestivalName] = useState(data?.tour || 'Festival')
  const [selected, setSelected] = useState(() =>
    new Set(data?.artists?.map((_, i) => i) || [])
  )
  const [importing, setImporting] = useState(false)

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
    if (selected.size === data.artists.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.artists.map((_, i) => i)))
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const toImport = data.artists.filter((_, i) => selected.has(i))

      // 1. Create festival parent entry
      const parent = await api.post('/concerts', {
        artist: festivalName,
        venue: data.venue,
        city: data.city,
        date: data.date,
        price: null,
        rating: 0,
        notes: '',
        last_minute: false,
      })

      // 2. Create child entries for each selected band
      for (let i = 0; i < toImport.length; i++) {
        const artist = toImport[i]
        await api.post('/concerts', {
          artist: artist.artist,
          venue: data.venue,
          city: data.city,
          date: data.date,
          price: null,
          rating: 0,
          notes: '',
          last_minute: false,
          setlist_fm_id: artist.setlist_fm_id,
          setlist_fm_url: artist.setlist_fm_url,
          parent_concert_id: parent.id,
          display_order: i,
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

  const formattedDate = data.date
    ? new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <Modal open={true} onClose={onClose} title="Festival Import">
      <div className="space-y-4">
        {/* Editable festival name */}
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg space-y-2">
          <label className="block text-[10px] uppercase tracking-wider text-text-dim">Festival Name</label>
          <input
            type="text"
            value={festivalName}
            onChange={e => setFestivalName(e.target.value)}
            className="w-full px-3 py-1.5 text-sm font-medium rounded-lg bg-bg-input border border-border text-text focus:outline-none focus:border-warning"
          />
          <p className="text-xs text-text-muted">
            {data.venue} · {data.city}
          </p>
          <p className="text-xs text-text-muted">{formattedDate}</p>
          <p className="text-xs text-text-dim">
            Found {data.artists.length} artist{data.artists.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Select all */}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleAll}
            className="text-xs text-secondary hover:text-secondary bg-transparent border-0 cursor-pointer"
          >
            {selected.size === data.artists.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-text-dim">
            {selected.size} selected
          </span>
        </div>

        {/* Artist list */}
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {data.artists.map((artist, i) => (
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
              <span className="flex-1 text-sm text-text truncate">{artist.artist}</span>
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
          disabled={selected.size === 0 || importing || !festivalName.trim()}
          className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing
            ? `Importing ${selected.size} artist${selected.size !== 1 ? 's' : ''}...`
            : `Import ${selected.size} Artist${selected.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </Modal>
  )
}
