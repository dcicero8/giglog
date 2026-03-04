import { useState } from 'react'

export default function SetlistUrlInput({ url, onUrlChange, altUrl, onAltUrlChange, onImport, onFestivalImport, loading, error, onClearError }) {
  const [showAlt, setShowAlt] = useState(false)
  const [isFestival, setIsFestival] = useState(false)

  return (
    <div className="p-4 bg-bg-card border border-border rounded-xl">
      <label className="block text-xs text-text-dim font-medium uppercase tracking-wider mb-2">
        Quick Add from setlist.fm URL
      </label>
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
        {/* Festival toggle */}
        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={isFestival}
            onChange={e => { setIsFestival(e.target.checked); if (e.target.checked) setShowAlt(false) }}
            className="accent-warning"
          />
          Festival (import all artists)
        </label>

        {/* Toggle for alternate setlist */}
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

      {error && <p className="text-xs text-accent mt-2">{error}</p>}
    </div>
  )
}
