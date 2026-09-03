import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { reverseGeocode, searchGeocode } from '../services/api.js'

// Custom sleek Leaflet DivIcon for citizen location selection
function createCitizenLocationIcon() {
  return L.divIcon({
    className: 'custom-citizen-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
        <div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: rgba(37, 99, 235, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 32px; height: 32px; border-radius: 9999px; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
          📍
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

// Map center updater helper component
function MapCenterUpdater({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, 15, { duration: 1.2 })
    }
  }, [center, map])
  return null
}

export default function LocationPicker({
  selectedLocation,
  onLocationChange,
  showToast,
}) {
  const [mode, setMode] = useState('search') // 'search' | 'gps'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [locatingGps, setLocatingGps] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showResultsDropdown, setShowResultsDropdown] = useState(false)

  // Default coordinate center (Chennai, India)
  const currentCoords = selectedLocation?.latitude && selectedLocation?.longitude
    ? [selectedLocation.latitude, selectedLocation.longitude]
    : [13.0827, 80.2707]

  // Search places via Nominatim Proxy on Enter or button click
  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    const query = searchQuery.trim()
    if (!query || query.length < 2) {
      setErrorMsg('Please enter at least 2 characters to search for a location.')
      return
    }

    setErrorMsg('')
    setSearching(true)
    setShowResultsDropdown(true)

    try {
      const res = await searchGeocode(query)
      const data = res.data || []
      setSearchResults(data)
      if (data.length === 0) {
        setErrorMsg(`No locations found for "${query}". Try adding "Chennai" or specifying a known street/landmark.`)
      }
    } catch {
      setErrorMsg('Location search failed. Please verify your connection or use GPS.')
    } finally {
      setSearching(false)
    }
  }

  // Select place from search results
  const handleSelectResult = (item) => {
    const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat)
    const lon = typeof item.lon === 'number' ? item.lon : parseFloat(item.lon)
    const address = item.display_name
    const shortName = item.short_name || address.split(',')[0]

    onLocationChange({
      latitude: lat,
      longitude: lon,
      address,
      shortName,
      locationString: `${lat.toFixed(5)},${lon.toFixed(5)}`,
      rawInput: address,
    })

    setShowResultsDropdown(false)
    setSearchQuery(shortName)
    setErrorMsg('')
    showToast?.(`📍 Selected location: ${shortName}`, 'success')
  }

  // Use Citizen's Current GPS Location
  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser. Please search for the location manually.')
      return
    }

    setErrorMsg('')
    setLocatingGps(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const coordStr = `${lat.toFixed(5)},${lon.toFixed(5)}`

        try {
          const res = await reverseGeocode(lat, lon)
          const placeName = res.data?.place_name || `Location (${coordStr})`
          const shortName = res.data?.short_name || coordStr

          onLocationChange({
            latitude: lat,
            longitude: lon,
            address: placeName,
            shortName,
            locationString: coordStr,
            rawInput: placeName,
          })

          setSearchQuery(shortName)
          showToast?.(`📍 GPS Location detected: ${shortName}`, 'success')
        } catch {
          onLocationChange({
            latitude: lat,
            longitude: lon,
            address: `GPS Pin (${coordStr})`,
            shortName: coordStr,
            locationString: coordStr,
            rawInput: coordStr,
          })
          showToast?.(`📍 GPS coordinates acquired: ${coordStr}`, 'info')
        } finally {
          setLocatingGps(false)
        }
      },
      (err) => {
        setLocatingGps(false)
        let friendly = 'Could not access GPS location. Please search and select the problem area manually.'
        if (err.code === 1) friendly = 'Location permission was denied. Please allow location access or search manually.'
        else if (err.code === 2) friendly = 'Location position unavailable. Please search manually.'
        else if (err.code === 3) friendly = 'Location request timed out. Please try again or search manually.'
        setErrorMsg(friendly)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // Clear selected location
  const handleClearLocation = () => {
    onLocationChange({
      latitude: null,
      longitude: null,
      address: '',
      shortName: '',
      locationString: '',
      rawInput: '',
    })
    setSearchQuery('')
    setSearchResults([])
    setShowResultsDropdown(false)
    setErrorMsg('')
  }

  const hasLocation = Boolean(selectedLocation?.latitude && selectedLocation?.longitude)

  return (
    <div id="grievance-location-picker" className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <span className="text-lg">📍</span>
          <span>Problem Location</span>
        </label>
        <span className="text-xs text-gray-500 font-medium">OpenStreetMap Powered</span>
      </div>

      {/* Tabs / Mode Switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          id="btn-mode-search"
          onClick={() => {
            setMode('search')
            setErrorMsg('')
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
            mode === 'search'
              ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-xs'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          <span>🔍</span>
          <span>Search Place / Area</span>
        </button>

        <button
          type="button"
          id="btn-mode-gps"
          onClick={() => {
            setMode('gps')
            handleUseGps()
          }}
          disabled={locatingGps}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
            mode === 'gps' || locatingGps
              ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-xs'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          <span className={locatingGps ? 'animate-spin' : ''}>{locatingGps ? '⚙️' : '📍'}</span>
          <span>{locatingGps ? 'Detecting GPS…' : 'Use My GPS'}</span>
        </button>
      </div>

      {/* Search Input Bar */}
      {mode === 'search' && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                id="input-location-search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowResultsDropdown(true)
                }}
                placeholder="e.g. Anna Nagar, T. Nagar, Adyar, Velachery, Chennai..."
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                    setShowResultsDropdown(false)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              id="btn-search-location"
              onClick={() => handleSearch()}
              disabled={searching || !searchQuery.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {searching ? (
                <>
                  <span className="animate-spin text-sm">⚙️</span>
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          {/* Search Results Dropdown */}
          {showResultsDropdown && searchResults.length > 0 && (
            <div
              id="location-search-results"
              className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100"
            >
              <div className="px-3 py-1.5 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                <span>Select Matching Civic Location</span>
                <button
                  type="button"
                  onClick={() => setShowResultsDropdown(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {searchResults.map((item, idx) => (
                <button
                  key={`search-res-${idx}`}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 transition flex items-start gap-2.5 cursor-pointer group"
                >
                  <span className="text-blue-600 group-hover:scale-110 transition shrink-0 mt-0.5 text-base">
                    📍
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {item.short_name || item.display_name.split(',')[0]}
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">
                      {item.display_name}
                    </p>
                  </div>
                  <span className="text-[10px] text-blue-600 font-bold shrink-0 self-center">
                    Select ➔
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selected Location Card & Leaflet Mini Map Preview */}
      {hasLocation ? (
        <div className="border border-emerald-200 bg-emerald-50/70 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="text-2xl mt-0.5">📌</span>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wide mb-1">
                  Location Confirmed
                </span>
                <p className="text-xs font-bold text-gray-900">
                  {selectedLocation.shortName || selectedLocation.address}
                </p>
                <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5">
                  {selectedLocation.address}
                </p>
                <p className="text-[10px] font-mono text-emerald-700 mt-1">
                  Coordinates: {selectedLocation.latitude?.toFixed(5)}° N, {selectedLocation.longitude?.toFixed(5)}° E
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-clear-location"
              onClick={handleClearLocation}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-100/60 px-2 py-1 rounded-lg transition cursor-pointer shrink-0"
              title="Remove location"
            >
              Change
            </button>
          </div>

          {/* Interactive Leaflet Mini Map Preview */}
          <div className="h-36 w-full rounded-xl overflow-hidden border border-emerald-300 shadow-inner relative z-0">
            <MapContainer
              center={currentCoords}
              zoom={15}
              scrollWheelZoom={false}
              dragging={true}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={currentCoords} icon={createCitizenLocationIcon()} />
              <MapCenterUpdater center={currentCoords} />
            </MapContainer>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span>Search an area or click &quot;Use My GPS&quot; to pin the civic issue location.</span>
          </div>
        </div>
      )}
    </div>
  )
}
