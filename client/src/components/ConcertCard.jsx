import { useState, useRef } from 'react'
import StarRating from './StarRating'
import TicketArtSVG from './TicketArtSVG'
import { EBAY_CATEGORIES, getEbayUrl, getYouTubeExactShowUrl, getYouTubeFullSetsUrl, getSpotifyArtistUrl } from '../lib/resellers'
import { api } from '../lib/api'

const STYLES = ['blue', 'gold', 'red', 'green', 'pink', 'orange', 'random']

const YT_MATCH_ICONS = {
  exact: { dot: 'bg-[#4ade80]', label: 'Exact show' },
  tour: { dot: 'bg-[#facc15]', label: 'Same tour' },
}

export default function ConcertCard({ concert, onEdit, onDelete, onViewSetlist, aiAvailable, onUpdate, setlistOpen }) {
  const [showEbay, setShowEbay] = useState(false)
  const [showYT, setShowYT] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [style, setStyle] = useState('classic')
  const [showArt, setShowArt] = useState(false)
  const [ytForm, setYtForm] = useState(false)
  const [ytUrl, setYtUrl] = useState('')
  const [ytMatch, setYtMatch] = useState('exact')
  const [uploading, setUploading] = useState(false)
  const [posterUploading, setPosterUploading] = useState(false)
  const ticketFileRef = useRef(null)
  const posterFileRef = useRef(null)

  const year = concert.date ? new Date(concert.date + 'T00:00:00').getFullYear() : ''
  const formattedDate = concert.date
    ? new Date(concert.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await api.post(`/concerts/${concert.id}/generate-ticket`, { style })
      onUpdate?.({ ...concert, ticket_art_svg: result.ticket_art_svg })
      setShowArt(true)
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        alert('Gemini API free tier quota exceeded. The limit resets daily — try again tomorrow, or upgrade your Gemini API plan.')
      } else {
        alert('Failed to generate: ' + msg)
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleTicketUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('ticket', file)
      const res = await fetch(`/api/concerts/${concert.id}/ticket-image`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onUpdate?.({ ...concert, ticket_image: data.ticket_image })
      setShowArt(true)
    } catch (err) {
      alert('Failed to upload: ' + err.message)
    } finally {
      setUploading(false)
      if (ticketFileRef.current) ticketFileRef.current.value = ''
    }
  }

  const handleRemoveTicketImage = async () => {
    try {
      await fetch(`/api/concerts/${concert.id}/ticket-image`, { method: 'DELETE' })
      onUpdate?.({ ...concert, ticket_image: null })
    } catch (err) {
      alert('Failed to remove: ' + err.message)
    }
  }

  const handlePosterUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPosterUploading(true)
    try {
      const formData = new FormData()
      formData.append('poster', file)
      const res = await fetch(`/api/concerts/${concert.id}/poster-image`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onUpdate?.({ ...concert, poster_image: data.poster_image })
    } catch (err) {
      alert('Failed to upload: ' + err.message)
    } finally {
      setPosterUploading(false)
      if (posterFileRef.current) posterFileRef.current.value = ''
    }
  }

  const handleRemovePoster = async () => {
    try {
      await fetch(`/api/concerts/${concert.id}/poster-image`, { method: 'DELETE' })
      onUpdate?.({ ...concert, poster_image: null })
    } catch (err) {
      alert('Failed to remove: ' + err.message)
    }
  }

  const handleSaveYT = async () => {
    if (!ytUrl.trim()) return
    try {
      const updated = await api.put(`/concerts/${concert.id}`, {
        youtube_url: ytUrl.trim(),
        youtube_match: ytMatch,
      })
      onUpdate?.(updated)
      setYtForm(false)
      setYtUrl('')
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  const handleRemoveYT = async () => {
    try {
      const updated = await api.put(`/concerts/${concert.id}`, {
        youtube_url: '',
        youtube_match: '',
      })
      onUpdate?.(updated)
    } catch (err) {
      alert('Failed to remove: ' + err.message)
    }
  }

  const matchInfo = concert.youtube_match ? YT_MATCH_ICONS[concert.youtube_match] : null

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:bg-bg-card-hover hover:border-border-hover hover:shadow-[0_0_25px_rgba(255,60,100,0.08)]">
      {/* Poster Image */}
      {concert.poster_image && (
        <div className="relative group">
          <img
            src={`/uploads/posters/${concert.poster_image}`}
            alt={`${concert.artist} poster`}
            className="w-full max-h-72 object-cover"
          />
          <button
            onClick={handleRemovePoster}
            className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-black/70 text-white hover:bg-accent transition-colors border-0 cursor-pointer opacity-0 group-hover:opacity-100"
          >
            Remove
          </button>
        </div>
      )}

      <div className="p-5">
      {/* Ticket Art / Uploaded Image */}
      {(concert.ticket_image || concert.ticket_art_svg) && (
        <div className="mb-4">
          <button
            onClick={() => setShowArt(!showArt)}
            className="text-xs text-accent hover:text-accent-hover bg-transparent border-0 cursor-pointer mb-2"
          >
            {showArt ? 'Hide Ticket Art ▲' : 'Show Ticket Art ▼'}
          </button>
          {showArt && (
            <>
              {concert.ticket_image ? (
                <div className="relative group">
                  <img
                    src={`/uploads/tickets/${concert.ticket_image}`}
                    alt={`${concert.artist} ticket`}
                    className="w-full rounded-lg"
                  />
                  <button
                    onClick={handleRemoveTicketImage}
                    className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-black/70 text-white hover:bg-accent transition-colors border-0 cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <TicketArtSVG svg={concert.ticket_art_svg} className="w-full" />
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base text-text truncate">{concert.artist}</h3>
          <p className="text-sm text-text-muted mt-1">
            {[concert.venue, concert.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button onClick={() => onEdit(concert)} className="text-text-muted hover:text-text bg-transparent border-0 cursor-pointer p-1 text-sm">
            ✎
          </button>
          <button onClick={() => onDelete(concert.id)} className="text-text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-1 text-sm">
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-text-muted mb-3">
        {formattedDate && <span>{formattedDate}</span>}
        {concert.price != null && concert.price > 0 && (
          <span className="text-success font-medium">${concert.price.toFixed(2)}</span>
        )}
        {concert.last_minute === 1 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">Last-Minute</span>
        )}
      </div>

      {concert.rating > 0 && (
        <div className="mb-3">
          <StarRating rating={concert.rating} readonly size="sm" />
        </div>
      )}

      {concert.notes && (
        <p className="text-sm text-text-muted mb-3 line-clamp-2">{concert.notes}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-border">
        {concert.setlist_fm_id ? (
          <button
            onClick={() => onViewSetlist(concert)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border-0 cursor-pointer ${
              setlistOpen
                ? 'bg-secondary/30 text-secondary ring-1 ring-secondary/40'
                : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
            }`}
          >
            {setlistOpen ? 'Hide Setlist' : 'View Setlist'}
          </button>
        ) : (
          <span className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-text-dim/40">
            View Setlist
          </span>
        )}
        <button
          onClick={() => setShowEbay(!showEbay)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors border-0 cursor-pointer"
        >
          Find Memorabilia
        </button>

        {/* YouTube button with match indicator */}
        <div className="relative">
          <button
            onClick={() => setShowYT(!showYT)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#ff0000]/10 text-[#ff4444] hover:bg-[#ff0000]/20 transition-colors border-0 cursor-pointer flex items-center gap-1.5"
          >
            ▶ YouTube
            {matchInfo && (
              <span className={`w-2 h-2 rounded-full ${matchInfo.dot} inline-block`} title={matchInfo.label} />
            )}
          </button>
          {showYT && (
            <div className="absolute left-0 top-full mt-1 z-10 bg-bg-card border border-border rounded-lg shadow-lg py-1 min-w-[200px]">
              {/* Saved link */}
              {concert.youtube_url && (
                <>
                  <a
                    href={concert.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-bg-card-hover no-underline transition-colors"
                    onClick={() => setShowYT(false)}
                  >
                    <span className={`w-2 h-2 rounded-full ${matchInfo?.dot} shrink-0`} />
                    Watch — {matchInfo?.label || 'Saved'}
                  </a>
                  <button
                    onClick={() => { handleRemoveYT(); setShowYT(false) }}
                    className="block w-full text-left px-3 py-1 text-[10px] text-text-muted hover:bg-bg-card-hover transition-colors bg-transparent border-0 cursor-pointer"
                  >
                    Remove saved link
                  </button>
                  <div className="border-t border-border my-1" />
                </>
              )}
              {/* Search links */}
              <a
                href={getYouTubeExactShowUrl(concert.artist, concert.venue, year)}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-1.5 text-xs text-text hover:bg-bg-card-hover no-underline transition-colors"
                onClick={() => setShowYT(false)}
              >
                Search this show
              </a>
              <a
                href={getYouTubeFullSetsUrl(concert.artist)}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-1.5 text-xs text-text hover:bg-bg-card-hover no-underline transition-colors"
                onClick={() => setShowYT(false)}
              >
                Search full live sets
              </a>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { setYtForm(true); setShowYT(false); setYtUrl(concert.youtube_url || '') }}
                className="block w-full text-left px-3 py-1.5 text-xs text-[#ff4444] hover:bg-bg-card-hover transition-colors bg-transparent border-0 cursor-pointer"
              >
                {concert.youtube_url ? 'Change saved link...' : 'Save a YouTube link...'}
              </button>
            </div>
          )}
        </div>

        {/* Spotify */}
        <a
          href={getSpotifyArtistUrl(concert.artist)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1db954]/10 text-[#1db954] hover:bg-[#1db954]/20 transition-colors no-underline border-0 cursor-pointer"
        >
          ♫ Spotify
        </a>
      </div>

      {/* YouTube save form */}
      {ytForm && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            value={ytUrl}
            onChange={e => setYtUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-bg-input border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-[#ff4444]"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input type="radio" name={`yt-match-${concert.id}`} checked={ytMatch === 'exact'} onChange={() => setYtMatch('exact')} className="accent-[#4ade80]" />
              <span className="w-2 h-2 rounded-full bg-[#4ade80] inline-block" />
              Exact show
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input type="radio" name={`yt-match-${concert.id}`} checked={ytMatch === 'tour'} onChange={() => setYtMatch('tour')} className="accent-[#facc15]" />
              <span className="w-2 h-2 rounded-full bg-[#facc15] inline-block" />
              Same tour
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveYT}
              disabled={!ytUrl.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#ff0000]/15 text-[#ff4444] hover:bg-[#ff0000]/25 transition-colors border-0 cursor-pointer disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => setYtForm(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-text-muted hover:bg-white/10 transition-colors border-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showEbay && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
          {EBAY_CATEGORIES.map(cat => (
            <a
              key={cat.label}
              href={getEbayUrl(concert.artist, concert.venue, year, cat.query)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs rounded-full bg-success/10 text-success hover:bg-success/20 transition-colors no-underline"
            >
              {cat.label}
            </a>
          ))}
        </div>
      )}

      {/* Ticket Art: Upload + AI Generate + Poster */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Upload ticket image */}
          <input
            ref={ticketFileRef}
            type="file"
            accept="image/*"
            onChange={handleTicketUpload}
            className="hidden"
          />
          <button
            onClick={() => ticketFileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : concert.ticket_image ? '📷 Replace Ticket' : '📷 Upload Ticket'}
          </button>

          {/* Upload poster */}
          <input
            ref={posterFileRef}
            type="file"
            accept="image/*"
            onChange={handlePosterUpload}
            className="hidden"
          />
          <button
            onClick={() => posterFileRef.current?.click()}
            disabled={posterUploading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {posterUploading ? 'Uploading...' : concert.poster_image ? '🎨 Replace Poster' : '🎨 Upload Poster'}
          </button>

          {/* AI Generate (only if available) */}
          {aiAvailable && (
            <>
              <select
                value={style}
                onChange={e => setStyle(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg bg-bg-input border border-border text-text cursor-pointer"
              >
                {STYLES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? 'Printing...' : concert.ticket_art_svg ? '🎟️ Reprint Ticket' : '🎟️ Print Ticket'}
              </button>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
