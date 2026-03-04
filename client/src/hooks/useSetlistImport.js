import { useState } from 'react'
import { api } from '../lib/api'

export function parseSetlistUrl(url) {
  const match = url.match(/setlist\.fm\/setlist\/.*?-([0-9a-f]+)\.html/i)
  return match ? match[1] : null
}

export function useSetlistImport() {
  const [setlistUrl, setSetlistUrl] = useState('')
  const [altSetlistUrl, setAltSetlistUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const importUrl = async () => {
    const id = parseSetlistUrl(setlistUrl)
    if (!id) {
      setError('Could not parse setlist ID from that URL.')
      return null
    }

    // If alternate URL provided, parse it for the setlist ID
    let altId = null
    if (altSetlistUrl.trim()) {
      altId = parseSetlistUrl(altSetlistUrl)
      if (!altId) {
        setError('Could not parse setlist ID from the alternate URL.')
        return null
      }
    }

    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/setlistfm/setlist/${id}`)

      let isoDate = ''
      if (data.eventDate) {
        const [d, m, y] = data.eventDate.split('-')
        isoDate = `${y}-${m}-${d}`
      }

      const city = [data.venue?.city?.name, data.venue?.city?.stateCode || data.venue?.city?.state, data.venue?.city?.country?.code]
        .filter(Boolean).join(', ')

      const tourNote = data.tour?.name ? `Tour: ${data.tour.name}` : ''
      const altNote = altId ? `Setlist from alternate show` : ''
      const notes = [tourNote, altNote].filter(Boolean).join('\n')

      const result = {
        artist: data.artist?.name || '',
        venue: data.venue?.name || '',
        city,
        date: isoDate,
        price: '',
        rating: 0,
        notes,
        last_minute: false,
        // Use alternate setlist ID for song display, but keep actual show URL
        setlist_fm_id: altId || id,
        setlist_fm_url: data.url || `https://www.setlist.fm/setlist/${id}.html`,
      }
      setSetlistUrl('')
      setAltSetlistUrl('')
      return result
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const importFestival = async () => {
    const id = parseSetlistUrl(setlistUrl)
    if (!id) {
      setError('Could not parse setlist ID from that URL.')
      return null
    }

    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/setlistfm/festival/${id}`)
      setSetlistUrl('')
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { setlistUrl, setSetlistUrl, altSetlistUrl, setAltSetlistUrl, loading, error, setError, importUrl, importFestival }
}
