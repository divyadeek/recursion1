import React, { useState, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'

// Category Icons and Metadata
const CATEGORY_ICONS = {
  water_supply: '💧',
  electricity: '⚡',
  roads: '🛣️',
  sanitation: '🚯',
  public_safety: '🛡️',
  street_lights: '💡',
  garbage_waste: '🗑️',
  waterlogging: '🌊',
  blocked_drain: '🛑',
  out_of_scope: '❓',
}

const CATEGORY_NAMES = {
  water_supply: 'Water Supply',
  electricity: 'Electricity Board',
  roads: 'Roads & Potholes',
  sanitation: 'Sanitation & Sewage',
  public_safety: 'Public Safety',
  street_lights: 'Street Lighting',
  garbage_waste: 'Solid Waste / Garbage',
  waterlogging: 'Waterlogging / Flooding',
  blocked_drain: 'Blocked Drain / Sewage Overflow',
  out_of_scope: 'Out of Scope',
}

const STATUS_CONFIG = {
  unsolved: {
    label: 'UNSOLVED',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    color: '#f59e0b',
  },
  in_progress: {
    label: 'IN PROGRESS',
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    color: '#2563eb',
  },
  solved: {
    label: 'SOLVED',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    color: '#10b981',
  },
  rejected: {
    label: 'REJECTED',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    color: '#e11d48',
  },
}

// Function to generate custom styled Leaflet HTML marker
function createCustomGrievanceIcon(g) {
  const isHighUrgency = (g.urgency_score || 0) >= 8 && g.status !== 'solved'
  const isSolved = g.status === 'solved'
  const isDuplicate = Boolean(g.is_duplicate || g.duplicate_cluster_id)
  const iconEmoji = CATEGORY_ICONS[g.category] || '📍'

  let bgColor = '#f59e0b' // amber
  let borderColor = '#ffffff'
  if (isSolved) bgColor = '#10b981' // green
  else if (isHighUrgency) bgColor = '#ef4444' // red
  else if (g.status === 'in_progress') bgColor = '#2563eb' // blue
  else if (g.status === 'rejected') bgColor = '#94a3b8' // gray

  const pulseClass = isHighUrgency ? 'high-urgency-marker' : ''

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
      ${
        isHighUrgency
          ? `<div class="${pulseClass}" style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background-color: rgba(239, 68, 68, 0.4);"></div>`
          : ''
      }
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 9999px;
        background-color: ${bgColor};
        border: 2.5px solid ${borderColor};
        box-shadow: 0 4px 8px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        user-select: none;
        transition: transform 0.2s;
      ">
        ${iconEmoji}
      </div>
      ${
        isDuplicate
          ? `<div style="
              position: absolute;
              top: -3px;
              right: -3px;
              width: 15px;
              height: 15px;
              background-color: #8b5cf6;
              border: 1.5px solid #ffffff;
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              color: white;
              font-weight: bold;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            " title="Duplicate / Clustered issue">👥</div>`
          : ''
      }
      <div style="
        position: absolute;
        bottom: -4px;
        padding: 0 4px;
        border-radius: 9999px;
        background-color: #1e293b;
        color: #f8fafc;
        font-size: 9px;
        font-weight: 800;
        line-height: 12px;
        border: 1px solid #ffffff;
      ">
        ${g.urgency_score || 5}/10
      </div>
    </div>
  `

  return L.divIcon({
    className: 'custom-leaflet-grievance-marker',
    html,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  })
}

// Leaflet Marker Cluster Layer Manager
function GrievanceMarkerClusterLayer({
  grievances,
  onSelectGrievance,
  onOpenStatusModal,
  onPreviewPhoto,
}) {
  const map = useMap()
  const clusterGroupRef = useRef(null)

  useEffect(() => {
    if (!map) return

    // Create marker cluster group
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    })

    clusterGroupRef.current = clusterGroup
    map.addLayer(clusterGroup)

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current)
      }
    }
  }, [map])

  useEffect(() => {
    const clusterGroup = clusterGroupRef.current
    if (!clusterGroup) return

    clusterGroup.clearLayers()

    grievances.forEach((g) => {
      const lat = typeof g.latitude === 'number' ? g.latitude : parseFloat(g.latitude)
      const lon = typeof g.longitude === 'number' ? g.longitude : parseFloat(g.longitude)
      if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return

      const marker = L.marker([lat, lon], {
        icon: createCustomGrievanceIcon(g),
      })

      // Construct popup HTML container
      const container = document.createElement('div')
      container.className = 'p-3.5 space-y-2.5 text-xs text-gray-800'
      container.style.maxWidth = '300px'

      const isHigh = (g.urgency_score || 0) >= 8
      const statusLabel = STATUS_CONFIG[g.status]?.label || g.status

      container.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <div>
            <span style="font-size: 10px; font-family: monospace; font-weight: bold; color: #94a3b8; text-transform: uppercase;">ID: #${g.id}</span>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
              <span style="font-size: 16px;">${CATEGORY_ICONS[g.category] || '📍'}</span>
              <strong style="color: #0f172a; font-size: 13px;">${CATEGORY_NAMES[g.category] || g.category}</strong>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span style="padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; border: 1px solid #cbd5e1; background-color: #f8fafc;">
              ${statusLabel}
            </span>
            <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: ${isHigh ? '#fee2e2' : '#fef3c7'}; color: ${isHigh ? '#991b1b' : '#92400e'};">
              Urgency ${g.urgency_score || 5}/10
            </span>
          </div>
        </div>

        <div style="background-color: #f8fafc; border-radius: 8px; padding: 6px 8px; border: 1px solid #e2e8f0;">
          <p style="font-weight: 600; color: #334155; margin: 0; display: flex; align-items: center; gap: 4px;">
            <span>📍</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.address || g.location || 'Chennai Area'}</span>
          </p>
          <p style="font-size: 10px; font-family: monospace; color: #64748b; margin: 2px 0 0 0;">
            ${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E
          </p>
        </div>

        <p style="color: #475569; font-style: italic; background-color: #f1f5f9; padding: 8px; border-radius: 6px; margin: 0; line-height: 1.4; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
          "${g.text}"
        </p>

        ${
          g.is_duplicate || g.duplicate_cluster_id
            ? `<div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 4px 8px; font-size: 11px; color: #5b21b6; font-weight: 600;">
                👥 Merged in Cluster #${g.duplicate_cluster_id || 'Active'}
              </div>`
            : ''
        }

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 4px; border-top: 1px solid #f1f5f9;">
          <button id="btn-popup-inspect-${g.id}" style="background-color: #2563eb; color: white; border: none; border-radius: 6px; padding: 6px 8px; font-weight: bold; cursor: pointer; font-size: 11px; transition: background-color 0.2s;">
            Full Details
          </button>
          <button id="btn-popup-status-${g.id}" style="background-color: #10b981; color: white; border: none; border-radius: 6px; padding: 6px 8px; font-weight: bold; cursor: pointer; font-size: 11px; transition: background-color 0.2s;">
            Update Status
          </button>
        </div>
      `

      // Add event listeners when popup opens
      marker.on('popupopen', () => {
        const inspectBtn = document.getElementById(`btn-popup-inspect-${g.id}`)
        if (inspectBtn) {
          inspectBtn.onclick = () => onSelectGrievance?.(g.id)
        }

        const statusBtn = document.getElementById(`btn-popup-status-${g.id}`)
        if (statusBtn) {
          statusBtn.onclick = () => onOpenStatusModal?.(g)
        }
      })

      marker.bindPopup(container, { maxWidth: 320 })
      clusterGroup.addLayer(marker)
    })
  }, [grievances, onSelectGrievance, onOpenStatusModal])

  return null
}

// Map bounds controller & flyer
function MapFlyToHandler({ selectedCoords, boundsToFit, triggerFit }) {
  const map = useMap()

  useEffect(() => {
    if (selectedCoords && Array.isArray(selectedCoords) && selectedCoords.length === 2) {
      map.flyTo(selectedCoords, 16, { duration: 1 })
    }
  }, [selectedCoords, map])

  useEffect(() => {
    if (triggerFit && boundsToFit && boundsToFit.length > 0) {
      try {
        const latLngBounds = L.latLngBounds(boundsToFit)
        map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 15 })
      } catch {
        // quiet fallback
      }
    }
  }, [triggerFit, boundsToFit, map])

  return null
}

export default function AdminMapDashboard({
  grievances = [],
  onSelectGrievance,
  onOpenStatusModal,
  onPreviewPhoto,
  onSwitchToFloodOpsMap,
}) {
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('all') // 'all' | 'high' (>=8) | 'medium' (>=5)
  const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPinGrievance, setSelectedPinGrievance] = useState(null)
  const [flyCoords, setFlyCoords] = useState(null)
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState(1)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Default coordinate center (Chennai, India)
  const defaultCenter = [13.0827, 80.2707]

  // Filter valid mapped grievances (must have valid latitude and longitude numbers)
  const mappedGrievances = useMemo(() => {
    return grievances.filter((g) => {
      const lat = typeof g.latitude === 'number' ? g.latitude : parseFloat(g.latitude)
      const lon = typeof g.longitude === 'number' ? g.longitude : parseFloat(g.longitude)
      return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0
    })
  }, [grievances])

  // Apply dashboard filters
  const filteredGrievances = useMemo(() => {
    return mappedGrievances.filter((g) => {
      if (filterCategory && g.category !== filterCategory) return false
      if (filterStatus && g.status !== filterStatus) return false
      if (filterUrgency === 'high' && (g.urgency_score || 0) < 8) return false
      if (filterUrgency === 'medium' && (g.urgency_score || 0) < 5) return false
      if (filterDuplicateOnly && !g.is_duplicate && !g.duplicate_cluster_id) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchText = (g.text || '').toLowerCase().includes(q)
        const matchLoc = (g.location || '').toLowerCase().includes(q)
        const matchAddr = (g.address || '').toLowerCase().includes(q)
        const matchDept = (g.department || '').toLowerCase().includes(q)
        const matchId = String(g.id || '').includes(q)
        if (!matchText && !matchLoc && !matchAddr && !matchDept && !matchId) return false
      }

      return true
    })
  }, [mappedGrievances, filterCategory, filterStatus, filterUrgency, filterDuplicateOnly, searchQuery])

  // Compute bounding box coordinates for fitting
  const allBounds = useMemo(() => {
    return filteredGrievances.map((g) => [g.latitude, g.longitude])
  }, [filteredGrievances])

  // Urgency stats for header counters
  const highUrgencyCount = useMemo(() => {
    return filteredGrievances.filter((g) => (g.urgency_score || 0) >= 8 && g.status !== 'solved').length
  }, [filteredGrievances])

  const duplicateCount = useMemo(() => {
    return filteredGrievances.filter((g) => g.is_duplicate || g.duplicate_cluster_id).length
  }, [filteredGrievances])

  const solvedCount = useMemo(() => {
    return filteredGrievances.filter((g) => g.status === 'solved').length
  }, [filteredGrievances])

  // Focus a specific grievance on map
  const handleFocusGrievance = (g) => {
    setSelectedPinGrievance(g)
    setFlyCoords([g.latitude, g.longitude])
  }

  return (
    <div id="admin-map-dashboard-container" className="space-y-4">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <span>Interactive Civic GIS Map</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live spatial view of citizen grievances across municipal zones in Chennai (OpenStreetMap & Leaflet)
            </p>
          </div>

          {/* Key Metric Pills & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {onSwitchToFloodOpsMap && (
              <button
                type="button"
                id="btn-switch-to-floodops-map"
                onClick={onSwitchToFloodOpsMap}
                className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 rounded-full font-bold border border-cyan-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Switch to FloodOps Inundation Risk Map"
              >
                <span>🌊</span>
                <span>FloodOps Risk Map</span>
              </button>
            )}
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-bold">
              📍 {filteredGrievances.length} / {mappedGrievances.length} Plotted
            </span>
            <span className="px-3 py-1 bg-rose-100 text-rose-900 rounded-full font-bold border border-rose-200">
              🚨 {highUrgencyCount} High Urgency
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-900 rounded-full font-bold border border-purple-200">
              👥 {duplicateCount} Duplicates
            </span>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full font-bold border border-emerald-200">
              ✅ {solvedCount} Solved
            </span>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-1 items-center">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <input
              type="text"
              id="map-filter-search"
              placeholder="Search locality, keyword, ID, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              id="map-filter-category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-xs cursor-pointer"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {CATEGORY_ICONS[key]} {name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              id="map-filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-xs cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="unsolved">⏳ Unsolved</option>
              <option value="in_progress">🔄 In Progress</option>
              <option value="solved">✅ Solved</option>
              <option value="rejected">❌ Rejected</option>
            </select>
          </div>

          {/* Urgency & Quick Actions */}
          <div className="flex gap-2">
            <select
              id="map-filter-urgency"
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-xs cursor-pointer"
            >
              <option value="all">Any Urgency</option>
              <option value="high">🚨 High (≥8)</option>
              <option value="medium">⚠️ Med (≥5)</option>
            </select>

            <button
              type="button"
              id="btn-fit-map-bounds"
              onClick={() => setFitBoundsTrigger((t) => t + 1)}
              title="Fit all markers to screen"
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border border-gray-200"
            >
              🎯 Center
            </button>
          </div>
        </div>

        {/* Filter Badges & Toggle Duplicates */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-filter-duplicates"
              onClick={() => setFilterDuplicateOnly(!filterDuplicateOnly)}
              className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer border flex items-center gap-1.5 ${
                filterDuplicateOnly
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
              }`}
            >
              <span>👥</span>
              <span>Duplicate Clusters Only</span>
            </button>

            <button
              type="button"
              id="btn-toggle-sidebar"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="px-3 py-1 rounded-full font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer border border-gray-200 flex items-center gap-1"
            >
              <span>{isSidebarOpen ? '◀ Hide Sidebar' : '▶ Show Sidebar'}</span>
            </button>
          </div>

          {(filterCategory || filterStatus || filterUrgency !== 'all' || filterDuplicateOnly || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setFilterCategory('')
                setFilterStatus('')
                setFilterUrgency('all')
                setFilterDuplicateOnly(false)
                setSearchQuery('')
              }}
              className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Map & Side List Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Side: Interactive Leaflet Map */}
        <div
          className={`${
            isSidebarOpen ? 'lg:col-span-8' : 'lg:col-span-12'
          } bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 relative`}
          style={{ height: '620px' }}
        >
          <MapContainer
            center={defaultCenter}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <GrievanceMarkerClusterLayer
              grievances={filteredGrievances}
              onSelectGrievance={onSelectGrievance}
              onOpenStatusModal={onOpenStatusModal}
              onPreviewPhoto={onPreviewPhoto}
            />

            <MapFlyToHandler
              selectedCoords={flyCoords}
              boundsToFit={allBounds}
              triggerFit={fitBoundsTrigger}
            />
          </MapContainer>

          {/* Floating Map Legend */}
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-2.5 shadow-lg text-[11px] space-y-1.5 pointer-events-auto max-w-[220px]">
            <p className="font-bold text-gray-800 flex items-center justify-between">
              <span>Map Legend</span>
              <span className="text-[10px] text-gray-400 font-normal">Live GIS</span>
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ring-2 ring-red-200"></span>
                <span>Urgent (≥8)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                <span>Unsolved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Resolved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Plotted Grievance List / Detail Inspector */}
        {isSidebarOpen && (
          <div
            className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden"
            style={{ height: '620px' }}
          >
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Mapped Grievances ({filteredGrievances.length})
                </h3>
                <p className="text-[11px] text-gray-500">Click any card to pan map</p>
              </div>

              {selectedPinGrievance && (
                <button
                  type="button"
                  onClick={() => setSelectedPinGrievance(null)}
                  className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 space-y-2">
              {filteredGrievances.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  <p className="text-2xl mb-1.5">🔍</p>
                  <p className="font-semibold text-gray-600">No grievances match the filter criteria</p>
                  <p className="text-[11px] mt-1">Try resetting filters or adjusting search keywords</p>
                </div>
              ) : (
                filteredGrievances.map((g) => {
                  const isSelected = selectedPinGrievance?.id === g.id
                  const isHigh = (g.urgency_score || 0) >= 8

                  return (
                    <div
                      key={`sidebar-item-${g.id}`}
                      onClick={() => handleFocusGrievance(g)}
                      className={`p-3 rounded-xl transition cursor-pointer border text-xs space-y-2 ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-400 shadow-sm ring-1 ring-blue-400'
                          : 'bg-white hover:bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base shrink-0">{CATEGORY_ICONS[g.category] || '📍'}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">
                              {CATEGORY_NAMES[g.category] || g.category}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono">ID: #{g.id}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              STATUS_CONFIG[g.status]?.badge || 'bg-gray-100'
                            }`}
                          >
                            {STATUS_CONFIG[g.status]?.label || g.status}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isHigh
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            Urgency {g.urgency_score || 5}/10
                          </span>
                        </div>
                      </div>

                      {/* Location snippet */}
                      <p className="text-[11px] text-gray-600 font-medium line-clamp-1 flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate">{g.address || g.location}</span>
                      </p>

                      {/* Complaint Text */}
                      <p className="text-[11px] text-gray-500 line-clamp-2 italic">
                        &quot;{g.text}&quot;
                      </p>

                      {/* Action buttons inside card */}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[11px]">
                        <span className="text-blue-600 font-bold hover:underline">
                          🎯 Zoom on Map
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenStatusModal?.(g)
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-bold transition border border-emerald-200 cursor-pointer"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectGrievance?.(g.id)
                            }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded font-bold transition border border-blue-200 cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
