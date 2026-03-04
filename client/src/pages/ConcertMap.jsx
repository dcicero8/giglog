import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api'

// Custom marker icons
const createIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 8px ${color}80;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

const pinkIcon = createIcon('#ff3c64')
const purpleIcon = createIcon('#a78bfa')

export default function ConcertMap() {
  const [markers, setMarkers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMarkers()
  }, [])

  const loadMarkers = async () => {
    try {
      const [concerts, upcoming] = await Promise.all([
        api.get('/concerts'),
        api.get('/upcoming'),
      ])

      const allShows = [
        ...concerts.map(c => ({ ...c, type: 'past' })),
        ...upcoming.map(u => ({ ...u, type: 'upcoming' })),
      ]

      // Geocode unique cities
      const cities = [...new Set(allShows.map(s => s.city).filter(Boolean))]
      const geocoded = {}

      for (const city of cities) {
        try {
          const result = await api.get(`/geocode?city=${encodeURIComponent(city)}`)
          geocoded[city] = result
        } catch {
          // Skip cities that fail to geocode
        }
      }

      const resolved = allShows
        .filter(s => s.city && geocoded[s.city])
        .map(s => ({
          ...s,
          lat: geocoded[s.city].lat,
          lon: geocoded[s.city].lon,
        }))

      setMarkers(resolved)
    } catch (err) {
      console.error('Failed to load map data:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-text mb-6">Concert Map</h1>

      <div className="flex items-center gap-4 mb-4 text-sm text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-accent inline-block" /> Past shows
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-secondary inline-block" /> Upcoming
        </span>
        <span>{markers.length} location{markers.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="h-[500px] rounded-xl bg-bg-card border border-border flex items-center justify-center">
          <p className="text-text-muted">Loading map...</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: '500px' }}>
          <MapContainer
            center={[37.0, -98.0]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {markers.map((m, i) => (
              <Marker key={`${m.id}-${m.type}-${i}`} position={[m.lat, m.lon]} icon={m.type === 'past' ? pinkIcon : purpleIcon}>
                <Popup>
                  <div style={{ color: '#e2e8f0', background: '#0a0a0f', padding: '8px', borderRadius: '8px', minWidth: '150px' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 4px', fontSize: '13px' }}>{m.artist}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '11px', opacity: 0.7 }}>
                      {[m.venue, m.city].filter(Boolean).join(' · ')}
                    </p>
                    {m.date && <p style={{ margin: '0', fontSize: '11px', opacity: 0.7 }}>{formatDate(m.date)}</p>}
                    {m.price > 0 && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#4ade80' }}>${m.price.toFixed(2)}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  )
}
