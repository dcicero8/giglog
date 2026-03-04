import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'

export default function Settings() {
  const { data: usage, refetch: refetchUsage } = useApi('/setlistfm/usage')
  const [importStatus, setImportStatus] = useState(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await api.get('/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `giglog-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const counts = [
        data.concerts?.length ? `${data.concerts.length} concerts` : null,
        data.upcoming?.length ? `${data.upcoming.length} upcoming` : null,
        data.wishlist?.length ? `${data.wishlist.length} wishlist` : null,
      ].filter(Boolean).join(', ')

      if (!window.confirm(`Import ${counts}? This will replace all existing data.`)) {
        e.target.value = ''
        return
      }

      const result = await api.post('/import', data)
      setImportStatus(result.message)
      e.target.value = ''
    } catch (err) {
      setImportStatus('Import failed: ' + err.message)
    }
  }

  const usagePercent = usage ? (usage.requestCount / usage.dailyLimit) * 100 : 0

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-text mb-8">Settings</h1>

      <div className="max-w-2xl space-y-8">
        {/* API Usage */}
        <section className="bg-bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-heading font-bold text-text mb-4">setlist.fm API Usage</h2>
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-text-muted">Today's requests</span>
              <span className="text-text font-medium">
                {usage?.requestCount ?? 0} / {usage?.dailyLimit ?? 1440}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-bg-input overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(usagePercent, 100)}%`,
                  backgroundColor: usagePercent > 80 ? '#ff3c64' : usagePercent > 50 ? '#fbbf24' : '#4ade80',
                }}
              />
            </div>
          </div>
          <p className="text-xs text-text-dim">
            {usage?.remaining ?? 1440} requests remaining. Resets daily at midnight.
          </p>
        </section>

        {/* Data Export/Import */}
        <section className="bg-bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-heading font-bold text-text mb-4">Data Management</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors border-0 cursor-pointer disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export Data (JSON)'}
            </button>
            <label className="px-4 py-2 text-sm font-semibold rounded-lg bg-bg-input text-text-muted hover:bg-bg-card-hover transition-colors border border-border cursor-pointer">
              Import Data (JSON)
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          {importStatus && (
            <p className="mt-3 text-sm text-success">{importStatus}</p>
          )}
        </section>

        {/* API Key Status */}
        <section className="bg-bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-heading font-bold text-text mb-4">API Configuration</h2>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="text-sm text-text-muted">setlist.fm API key configured via environment variable</span>
          </div>
          <p className="text-xs text-text-dim mt-2">
            The API key is stored securely in the server's .env file and is never exposed to the browser.
          </p>
        </section>

        {/* About */}
        <section className="bg-bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-heading font-bold text-text mb-2">About GigLog</h2>
          <p className="text-sm text-text-muted">
            A personal concert tracker for logging shows, tracking upcoming events, and scanning ticket prices.
          </p>
        </section>
      </div>
    </div>
  )
}
