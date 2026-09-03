import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { getFloodOpsRiskAssessment } from '../services/api.js'

// Risk Level Visual Configurations
export const RISK_CONFIG = {
  low: {
    label: 'Low Risk',
    scoreRange: '0–24',
    color: '#22c55e', // Green
    borderColor: '#16a34a',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    icon: '🟢',
  },
  medium: {
    label: 'Medium Risk',
    scoreRange: '25–49',
    color: '#eab308', // Yellow
    borderColor: '#ca8a04',
    bg: 'bg-amber-50 text-amber-800 border-amber-300',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: '🟡',
  },
  high: {
    label: 'High Risk',
    scoreRange: '50–74',
    color: '#f97316', // Orange
    borderColor: '#ea580c',
    bg: 'bg-orange-50 text-orange-800 border-orange-300',
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    icon: '🟠',
  },
  critical: {
    label: 'Critical Risk',
    scoreRange: '75–100',
    color: '#ef4444', // Red
    borderColor: '#dc2626',
    bg: 'bg-rose-50 text-rose-800 border-rose-300',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    icon: '🔴',
  },
}

export const CONFIDENCE_CONFIG = {
  high: {
    label: 'High Confidence',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    fillOpacity: 0.65,
    dashArray: null,
    borderWidth: 2.2,
    description: 'Corroborated by live rainfall telemetry, recent citizen complaints, and photos.',
  },
  medium: {
    label: 'Medium Confidence',
    badge: 'bg-sky-100 text-sky-900 border-sky-300',
    fillOpacity: 0.38,
    dashArray: null,
    borderWidth: 1.8,
    description: 'Moderate data availability or partial correlation between telemetry and ground reports.',
  },
  low: {
    label: 'Low Confidence',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    fillOpacity: 0.14,
    dashArray: '6, 6',
    borderWidth: 1.6,
    description: 'Sparse ground intake or heuristic proxy fallback. Field patrol recommended.',
  },
}

// Action icon & styling
const ACTION_BADGES = {
  'Dispatch Drainage Team': {
    color: 'bg-rose-100 text-rose-900 border-rose-300',
    icon: '🚨',
  },
  'Request Field Verification Patrol': {
    color: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: '🔍',
  },
  'Monitor/Reassess': {
    color: 'bg-blue-100 text-blue-900 border-blue-300',
    icon: '⏱️',
  },
  'Coverage Gap / Request More Evidence': {
    color: 'bg-purple-100 text-purple-900 border-purple-300',
    icon: '📡',
  },
  'Routine Monitoring': {
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: '🛡️',
  },
}

function getActionBadge(actionText = '') {
  for (const [key, val] of Object.entries(ACTION_BADGES)) {
    if (actionText.toLowerCase().includes(key.toLowerCase())) {
      return val
    }
  }
  return { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '📋' }
}

// Helper: Filter flood relevant grievances
function isFloodRelevant(g) {
  if (!g || !g.category) return false
  const cat = g.category
  if (cat === 'waterlogging' || cat === 'blocked_drain') return true
  if (cat === 'sanitation') {
    const text = (g.text || '').toLowerCase()
    const floodKeywords = [
      'drain',
      'sewage',
      'overflow',
      'stagnant water',
      'waterlogged',
      'flooding',
      'flood',
      'blocked drain',
    ]
    return floodKeywords.some((kw) => text.includes(kw))
  }
  return false
}

// Custom Leaflet DivIcon for flood-relevant citizen reports
function createFloodGrievanceMarkerIcon(g, isLinkedToSelectedCell) {
  const isHighUrgency = (g.urgency_score || 0) >= 8 && g.status !== 'solved'
  const isSolved = g.status === 'solved'
  const iconEmoji = g.category === 'blocked_drain' ? '🛑' : g.category === 'waterlogging' ? '🌊' : '🚯'

  let bgColor = '#0284c7' // sky blue default
  if (isSolved) bgColor = '#10b981'
  else if (isHighUrgency) bgColor = '#ef4444'

  const borderHighlight = isLinkedToSelectedCell ? 'border: 3px solid #f59e0b; transform: scale(1.15);' : 'border: 2px solid #ffffff;'

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
      ${
        isHighUrgency
          ? `<div class="high-urgency-marker" style="position: absolute; width: 34px; height: 34px; border-radius: 9999px; background-color: rgba(239, 68, 68, 0.4);"></div>`
          : ''
      }
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background-color: ${bgColor};
        ${borderHighlight}
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        user-select: none;
        transition: transform 0.2s;
      ">
        ${iconEmoji}
      </div>
      <div style="
        position: absolute;
        bottom: -4px;
        padding: 0 3px;
        border-radius: 9999px;
        background-color: #0f172a;
        color: #f8fafc;
        font-size: 8px;
        font-weight: 800;
        line-height: 10px;
        border: 1px solid #ffffff;
      ">
        ${g.urgency_score || 5}/10
      </div>
    </div>
  `

  return L.divIcon({
    className: 'custom-leaflet-flood-marker',
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  })
}

// Leaflet Layer Component for 500m x 500m Risk Grid Cells
function FloodRiskGridLayer({
  cells,
  selectedCellId,
  onSelectCell,
  showControlsConfidence,
  filteredRiskTier,
}) {
  const map = useMap()
  const layerGroupRef = useRef(null)

  useEffect(() => {
    if (!map) return
    const layerGroup = L.layerGroup()
    layerGroupRef.current = layerGroup
    map.addLayer(layerGroup)

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current)
      }
    }
  }, [map])

  useEffect(() => {
    const layerGroup = layerGroupRef.current
    if (!layerGroup) return

    layerGroup.clearLayers()

    cells.forEach((cell) => {
      const { bounds, waterloggingRisk, riskLevel, confidenceLabel, cellId, areaName } = cell
      if (!bounds) return

      const riskConf = RISK_CONFIG[riskLevel] || RISK_CONFIG.low
      const confStyle = CONFIDENCE_CONFIG[confidenceLabel] || CONFIDENCE_CONFIG.medium

      const isSelected = selectedCellId === cellId

      // Rectangle styling
      const rectOptions = {
        color: isSelected ? '#1e293b' : riskConf.borderColor,
        weight: isSelected ? 3.5 : confStyle.borderWidth,
        opacity: 0.95,
        fillColor: riskConf.color,
        fillOpacity: isSelected ? Math.min(0.9, confStyle.fillOpacity + 0.2) : confStyle.fillOpacity,
        dashArray: confStyle.dashArray,
      }

      const rectBounds = [
        [bounds.minLat, bounds.minLon],
        [bounds.maxLat, bounds.maxLon],
      ]

      const rectangle = L.rectangle(rectBounds, rectOptions)

      // Hover feedback
      rectangle.on('mouseover', () => {
        rectangle.setStyle({
          weight: 3.5,
          color: '#0f172a',
          fillOpacity: Math.min(0.9, confStyle.fillOpacity + 0.15),
        })
      })

      rectangle.on('mouseout', () => {
        if (selectedCellId !== cellId) {
          rectangle.setStyle(rectOptions)
        }
      })

      // Click to inspect
      rectangle.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelectCell(cell)
      })

      // Tooltip on rectangle hover
      rectangle.bindTooltip(
        `
        <div style="font-family: sans-serif; padding: 2px;">
          <div style="font-weight: bold; font-size: 12px; color: #0f172a;">${areaName} Sector</div>
          <div style="display: flex; gap: 6px; align-items: center; margin-top: 2px; font-size: 11px;">
            <span style="font-weight: 800; color: ${riskConf.borderColor};">${waterloggingRisk}/100 (${riskConf.label})</span>
            <span style="color: #64748b;">•</span>
            <span style="color: #475569;">${confidenceLabel.toUpperCase()} Conf.</span>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Click cell to inspect multi-factor evidence</div>
        </div>
        `,
        { sticky: true, opacity: 0.95 }
      )

      layerGroup.addLayer(rectangle)

      // Center label icon showing Area name and risk pill
      const centerLat = (bounds.minLat + bounds.maxLat) / 2
      const centerLon = (bounds.minLon + bounds.maxLon) / 2

      const labelHtml = `
        <div style="
          background-color: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(4px);
          border: 1px solid ${isSelected ? '#0284c7' : '#cbd5e1'};
          border-radius: 9999px;
          padding: 2px 7px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.18);
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          cursor: pointer;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          transform: translate(-50%, -50%);
          pointer-events: auto;
        ">
          <span style="font-size: 10px;">${riskConf.icon}</span>
          <span style="font-size: 11px; font-weight: 700; color: #0f172a;">${areaName}</span>
          <span style="
            font-size: 10px;
            font-weight: 800;
            background-color: ${riskConf.color};
            color: #ffffff;
            padding: 1px 5px;
            border-radius: 9999px;
          ">${waterloggingRisk}</span>
        </div>
      `

      const labelMarker = L.marker([centerLat, centerLon], {
        icon: L.divIcon({
          className: 'custom-grid-cell-label',
          html: labelHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: true,
      })

      labelMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelectCell(cell)
      })

      layerGroup.addLayer(labelMarker)
    })
  }, [cells, selectedCellId, onSelectCell])

  return null
}

// Leaflet Marker Cluster Layer for Flood-Relevant Complaints
function FloodComplaintMarkersLayer({
  grievances,
  selectedCell,
  onSelectGrievance,
  onOpenStatusModal,
}) {
  const map = useMap()
  const clusterGroupRef = useRef(null)

  useEffect(() => {
    if (!map) return

    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 35,
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

    const linkedIdsSet = new Set(selectedCell?.linkedComplaintIds || [])

    grievances.forEach((g) => {
      const lat = typeof g.latitude === 'number' ? g.latitude : parseFloat(g.latitude)
      const lon = typeof g.longitude === 'number' ? g.longitude : parseFloat(g.longitude)
      if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return

      const isLinked = linkedIdsSet.has(g.id)

      const marker = L.marker([lat, lon], {
        icon: createFloodGrievanceMarkerIcon(g, isLinked),
      })

      const container = document.createElement('div')
      container.className = 'p-3 space-y-2 text-xs text-gray-800'
      container.style.maxWidth = '300px'

      const isHigh = (g.urgency_score || 0) >= 8

      container.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
          <div>
            <span style="font-size: 10px; font-family: monospace; font-weight: bold; color: #94a3b8; text-transform: uppercase;">ID: #${g.id.slice(0, 8)}</span>
            <div style="display: flex; align-items: center; gap: 5px; margin-top: 2px;">
              <span style="font-size: 14px;">🌊</span>
              <strong style="color: #0f172a; font-size: 12px;">Flood Ground Evidence</strong>
            </div>
          </div>
          <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: ${isHigh ? '#fee2e2' : '#e0f2fe'}; color: ${isHigh ? '#991b1b' : '#0369a1'};">
            Urgency ${g.urgency_score || 5}/10
          </span>
        </div>

        <p style="font-weight: 600; color: #334155; margin: 0; display: flex; align-items: center; gap: 4px;">
          <span>📍</span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.address || g.location || 'Chennai Area'}</span>
        </p>

        <p style="color: #475569; font-style: italic; background-color: #f8fafc; padding: 6px; border-radius: 6px; margin: 0; line-height: 1.4; border: 1px solid #e2e8f0;">
          "${g.text}"
        </p>

        ${
          g.reportCredibility
            ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 4px 6px; font-size: 10px; color: #166534; font-weight: 600;">
                🛡️ Credibility: ${g.reportCredibility.score}/100 (${g.reportCredibility.label})
              </div>`
            : ''
        }

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-top: 4px; border-top: 1px solid #f1f5f9;">
          <button id="btn-flood-inspect-${g.id}" style="background-color: #0284c7; color: white; border: none; border-radius: 6px; padding: 6px; font-weight: bold; cursor: pointer; font-size: 11px;">
            Inspect
          </button>
          <button id="btn-flood-status-${g.id}" style="background-color: #10b981; color: white; border: none; border-radius: 6px; padding: 6px; font-weight: bold; cursor: pointer; font-size: 11px;">
            Status
          </button>
        </div>
      `

      marker.on('popupopen', () => {
        const btnInspect = document.getElementById(`btn-flood-inspect-${g.id}`)
        if (btnInspect) btnInspect.onclick = () => onSelectGrievance?.(g.id)

        const btnStatus = document.getElementById(`btn-flood-status-${g.id}`)
        if (btnStatus) btnStatus.onclick = () => onOpenStatusModal?.(g)
      })

      marker.bindPopup(container, { maxWidth: 300 })
      clusterGroup.addLayer(marker)
    })
  }, [grievances, selectedCell, onSelectGrievance, onOpenStatusModal])

  return null
}

// Smooth Map Flyer
function MapFlyController({ centerCoords, boundsToFit, triggerFit }) {
  const map = useMap()

  useEffect(() => {
    if (centerCoords && Array.isArray(centerCoords) && centerCoords.length === 2) {
      map.flyTo(centerCoords, 15, { duration: 1.2 })
    }
  }, [centerCoords, map])

  useEffect(() => {
    if (triggerFit && boundsToFit && boundsToFit.length > 0) {
      try {
        const bounds = L.latLngBounds(boundsToFit)
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      } catch {
        // quiet fallback
      }
    }
  }, [triggerFit, boundsToFit, map])

  return null
}

export default function AdminFloodOpsMap({
  grievances = [],
  onSelectGrievance,
  onOpenStatusModal,
  onSwitchToComplaintMap,
  onSwitchToPriorityDispatch,
}) {
  // State from API
  const [riskData, setRiskData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)

  // Map Controls State
  const [filterRiskTier, setFilterRiskTier] = useState('all') // 'all' | 'critical' | 'high' | 'medium' | 'low'
  const [filterConfidence, setFilterConfidence] = useState('all') // 'all' | 'high' | 'medium' | 'low'
  const [showEvidenceReports, setShowEvidenceReports] = useState(true)
  const [showCoverageGapsOnly, setShowCoverageGapsOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Selection and UI state
  const [selectedCell, setSelectedCell] = useState(null)
  const [flyCenter, setFlyCenter] = useState(null)
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState(1)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true)

  // Default coordinate center (Chennai Central)
  const defaultCenter = [13.0418, 80.2341]

  // Fetch Risk Assessment from Server
  const fetchRiskData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getFloodOpsRiskAssessment()
      setRiskData(res.data)
      setLastRefreshedAt(new Date())
      // If a cell was selected, refresh its reference
      if (selectedCell) {
        const updated = res.data.cells?.find((c) => c.cellId === selectedCell.cellId)
        if (updated) setSelectedCell(updated)
      } else if (res.data.cells?.length > 0) {
        // Default select the highest risk cell for immediate actionable overview
        const sorted = [...res.data.cells].sort((a, b) => b.waterloggingRisk - a.waterloggingRisk)
        setSelectedCell(sorted[0])
      }
    } catch (err) {
      console.error('Failed to fetch FloodOps risk assessment:', err)
      setError(err?.response?.data?.detail || 'Failed to load live waterlogging risk telemetry.')
    } finally {
      setLoading(false)
    }
  }, [selectedCell])

  useEffect(() => {
    fetchRiskData()
  }, [])

  // Filter flood-relevant complaints for evidence layer
  const floodEvidenceGrievances = useMemo(() => {
    return grievances.filter((g) => isFloodRelevant(g))
  }, [grievances])

  // Filter cells based on controls
  const filteredCells = useMemo(() => {
    if (!riskData?.cells) return []

    return riskData.cells.filter((cell) => {
      // Filter by coverage gaps only
      if (showCoverageGapsOnly) {
        const isGap =
          cell.recommendedAction?.toLowerCase().includes('coverage gap') ||
          cell.confidenceLabel === 'low' ||
          (cell.linkedComplaintIds?.length === 0 && cell.confidence < 45)
        if (!isGap) return false
      }

      // Filter by risk tier
      if (filterRiskTier !== 'all' && cell.riskLevel !== filterRiskTier) {
        return false
      }

      // Filter by confidence
      if (filterConfidence !== 'all' && cell.confidenceLabel !== filterConfidence) {
        return false
      }

      // Search query (area name or evidence keyword)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = cell.areaName?.toLowerCase().includes(q)
        const matchEvidence = cell.evidence?.some((ev) => ev.toLowerCase().includes(q))
        const matchAction = cell.recommendedAction?.toLowerCase().includes(q)
        if (!matchName && !matchEvidence && !matchAction) return false
      }

      return true
    })
  }, [riskData, filterRiskTier, filterConfidence, showCoverageGapsOnly, searchQuery])

  // Bounds for "Center Map" button
  const allCellBounds = useMemo(() => {
    if (!filteredCells || filteredCells.length === 0) return []
    const points = []
    filteredCells.forEach((c) => {
      if (c.bounds) {
        points.push([c.bounds.minLat, c.bounds.minLon])
        points.push([c.bounds.maxLat, c.bounds.maxLon])
      }
    })
    return points
  }, [filteredCells])

  // Linked grievances for the currently selected cell
  const selectedCellLinkedGrievances = useMemo(() => {
    if (!selectedCell?.linkedComplaintIds || selectedCell.linkedComplaintIds.length === 0) {
      return []
    }
    const idSet = new Set(selectedCell.linkedComplaintIds)
    return grievances.filter((g) => idSet.has(g.id))
  }, [selectedCell, grievances])

  const handleSelectCell = (cell) => {
    setSelectedCell(cell)
    setIsSidePanelOpen(true)
    if (cell.coordinates) {
      setFlyCenter([cell.coordinates.latitude, cell.coordinates.longitude])
    }
  }

  // Summary counts
  const summary = riskData?.summary || {
    criticalRiskCount: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
    totalLinkedComplaints: 0,
  }

  return (
    <div id="admin-floodops-map-container" className="space-y-4">
      {/* Top Header & Operational Status Banner */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🌊</span>
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>FloodOps Inundation Risk Map</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-100 text-cyan-900 border border-cyan-300">
                    500m Grid Precision
                  </span>
                </h2>
                <p className="text-xs text-gray-500">
                  Transparent multi-factor evidence fusion of Open-Meteo rainfall telemetry, citizen complaint intake, and Chennai drainage baselines.
                </p>
              </div>
            </div>
          </div>

          {/* Mode Switcher & Quick Navigation */}
          <div className="flex items-center gap-2">
            {onSwitchToPriorityDispatch && (
              <button
                type="button"
                id="btn-switch-to-priority-dispatch"
                onClick={onSwitchToPriorityDispatch}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition border border-purple-200 flex items-center gap-1.5 cursor-pointer"
                title="Switch to ranked municipal priority operations table"
              >
                <span>🚨</span>
                <span>Priority Dispatch</span>
              </button>
            )}

            {onSwitchToComplaintMap && (
              <button
                type="button"
                id="btn-switch-to-complaint-map"
                onClick={onSwitchToComplaintMap}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition border border-gray-200 flex items-center gap-1.5 cursor-pointer"
                title="Switch back to standard civic complaint pin map"
              >
                <span>🗺️</span>
                <span>Switch to Complaint Map</span>
              </button>
            )}

            <button
              type="button"
              id="btn-refresh-floodops-risk"
              onClick={fetchRiskData}
              disabled={loading}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>{loading ? 'Refreshing…' : 'Refresh Environmental Risk'}</span>
            </button>
          </div>
        </div>

        {/* Operational Disclaimer Banner */}
        <div className="bg-cyan-50/70 border border-cyan-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-cyan-950">
          <span className="text-base shrink-0">ℹ️</span>
          <div className="flex-1">
            <p className="font-bold text-cyan-900">
              Inferred Risk Protocol Notice:
            </p>
            <p className="text-cyan-800 text-[11px] leading-relaxed mt-0.5">
              {riskData?.disclaimer || 'This is an inferred environmental-risk estimate, not a direct sensor measurement.'}{' '}
              Predictions project surface inundation risk over the <strong>{riskData?.predictionHorizon || 'next 3 hours'}</strong>. All municipal action advisories must be cross-verified with field staff.
            </p>
          </div>
          {lastRefreshedAt && (
            <span className="text-[10px] text-cyan-700 font-mono shrink-0 hidden sm:inline-block">
              Updated: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Risk & Confidence Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1 text-xs">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-rose-900">🚨 Critical (75+)</div>
            <div className="text-lg font-black text-rose-700">{summary.criticalRiskCount || 0}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-orange-900">🟠 High (50–74)</div>
            <div className="text-lg font-black text-orange-700">{summary.highRiskCount || 0}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-amber-900">🟡 Med (25–49)</div>
            <div className="text-lg font-black text-amber-700">{summary.mediumRiskCount || 0}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-emerald-900">🟢 Low (0–24)</div>
            <div className="text-lg font-black text-emerald-700">{summary.lowRiskCount || 0}</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-indigo-900">🛡️ High Conf.</div>
            <div className="text-lg font-black text-indigo-700">{summary.highConfidenceCount || 0}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-purple-900">👥 Evidence Reports</div>
            <div className="text-lg font-black text-purple-700">{floodEvidenceGrievances.length}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-slate-800">🎯 Grid Cells</div>
            <div className="text-lg font-black text-slate-700">{filteredCells.length} / {riskData?.totalCells || 12}</div>
          </div>
        </div>

        {/* Map Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          {/* Controls Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search Box */}
            <div className="relative min-w-[160px] sm:min-w-[200px]">
              <input
                type="text"
                id="floodops-filter-search"
                placeholder="Search sector (e.g. Velachery)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none bg-white shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Control 1: Waterlogging Risk Tier */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <span className="text-gray-500 font-semibold">Risk:</span>
              <select
                id="control-floodops-risk"
                value={filterRiskTier}
                onChange={(e) => setFilterRiskTier(e.target.value)}
                className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Risks</option>
                <option value="critical">🔴 Critical (75–100)</option>
                <option value="high">🟠 High (50–74)</option>
                <option value="medium">🟡 Medium (25–49)</option>
                <option value="low">🟢 Low (0–24)</option>
              </select>
            </div>

            {/* Control 2: Confidence */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <span className="text-gray-500 font-semibold">Confidence:</span>
              <select
                id="control-floodops-confidence"
                value={filterConfidence}
                onChange={(e) => setFilterConfidence(e.target.value)}
                className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Confidences</option>
                <option value="high">🛡️ High (Solid Fill)</option>
                <option value="medium">🔷 Medium (Translucent)</option>
                <option value="low">❓ Low (Dashed Border)</option>
              </select>
            </div>

            {/* Control 3: Toggle Evidence Reports */}
            <button
              type="button"
              id="control-floodops-evidence-reports"
              onClick={() => setShowEvidenceReports(!showEvidenceReports)}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                showEvidenceReports
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
              }`}
            >
              <span>{showEvidenceReports ? '👁️' : '🙈'}</span>
              <span>Evidence Reports ({floodEvidenceGrievances.length})</span>
            </button>

            {/* Control 4: Coverage Gaps Filter */}
            <button
              type="button"
              id="control-floodops-coverage-gaps"
              onClick={() => setShowCoverageGapsOnly(!showCoverageGapsOnly)}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                showCoverageGapsOnly
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white hover:bg-purple-50 text-purple-900 border-purple-300'
              }`}
              title="Highlight sectors with sparse ground evidence or low confidence baselines"
            >
              <span>📡</span>
              <span>Coverage Gaps</span>
            </button>

            {/* Center Map */}
            <button
              type="button"
              id="btn-center-floodops-map"
              onClick={() => setFitBoundsTrigger((t) => t + 1)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition border border-gray-200 cursor-pointer"
              title="Fit map to all cells"
            >
              🎯 Center
            </button>
          </div>

          {/* Reset Filters & Side Panel Toggle */}
          <div className="flex items-center gap-2 text-xs">
            {(filterRiskTier !== 'all' || filterConfidence !== 'all' || showCoverageGapsOnly || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterRiskTier('all')
                  setFilterConfidence('all')
                  setShowCoverageGapsOnly(false)
                  setSearchQuery('')
                }}
                className="text-rose-600 font-bold hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}

            <button
              type="button"
              id="btn-toggle-floodops-sidebar"
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="px-3 py-1.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer border border-gray-200"
            >
              {isSidePanelOpen ? '◀ Hide Details' : '▶ Show Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Map & Side Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Map Container */}
        <div
          className={`${
            isSidePanelOpen ? 'lg:col-span-7 xl:col-span-7' : 'lg:col-span-12'
          } bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 relative`}
          style={{ height: '650px' }}
        >
          {loading && !riskData && (
            <div className="absolute inset-0 z-30 bg-white/80 backdrop-blur-xs flex items-center justify-center">
              <div className="text-center space-y-2">
                <span className="text-3xl animate-spin inline-block">🌊</span>
                <p className="text-sm font-bold text-gray-800">Computing 500m Grid Risk Telemetry…</p>
                <p className="text-xs text-gray-500">Querying Open-Meteo precipitation stream & complaint intake</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-4 right-4 z-30 bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-900 shadow-md flex justify-between items-center">
              <div>
                <strong>Telemetry Error:</strong> {error}
              </div>
              <button
                onClick={fetchRiskData}
                className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

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

            {/* 500m x 500m Grid Rectangles */}
            <FloodRiskGridLayer
              cells={filteredCells}
              selectedCellId={selectedCell?.cellId}
              onSelectCell={handleSelectCell}
              showControlsConfidence={filterConfidence}
              filteredRiskTier={filterRiskTier}
            />

            {/* Citizen Ground Evidence Markers (Filtered to flood-relevant) */}
            {showEvidenceReports && (
              <FloodComplaintMarkersLayer
                grievances={floodEvidenceGrievances}
                selectedCell={selectedCell}
                onSelectGrievance={onSelectGrievance}
                onOpenStatusModal={onOpenStatusModal}
              />
            )}

            <MapFlyController
              centerCoords={flyCenter}
              boundsToFit={allCellBounds}
              triggerFit={fitBoundsTrigger}
            />
          </MapContainer>

          {/* Floating Map Legend */}
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-3 shadow-lg text-[11px] space-y-2 pointer-events-auto max-w-[280px]">
            <div className="font-bold text-gray-900 flex items-center justify-between border-b border-gray-100 pb-1">
              <span>FloodOps Legend</span>
              <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded font-bold border border-cyan-200">
                500m Grid
              </span>
            </div>

            {/* Risk Colors */}
            <div className="space-y-1 text-gray-700">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Inundation Risk (0–100)
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#ef4444] inline-block border border-red-700"></span>
                  <span>75–100: Critical</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#f97316] inline-block border border-orange-700"></span>
                  <span>50–74: High</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#eab308] inline-block border border-amber-600"></span>
                  <span>25–49: Medium</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#22c55e] inline-block border border-emerald-700"></span>
                  <span>0–24: Low</span>
                </div>
              </div>
            </div>

            {/* Confidence Stencil */}
            <div className="border-t border-gray-100 pt-1.5 space-y-1 text-gray-700">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Evidence Confidence
              </span>
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-2.5 bg-blue-500 rounded-xs inline-block"></span>
                  <span>High: Solid Fill (corroborated)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-2.5 bg-blue-500/40 border border-blue-500 rounded-xs inline-block"></span>
                  <span>Med: Semi-translucent</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-2.5 bg-blue-500/10 border border-dashed border-blue-600 rounded-xs inline-block"></span>
                  <span>Low: Dashed Border (coverage gap)</span>
                </div>
              </div>
            </div>

            {/* Evidence Marker Legend */}
            <div className="border-t border-gray-100 pt-1 text-[10px] text-gray-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>🌊</span>
                <span>Citizen Reports</span>
              </span>
              <span>Click cell for audit</span>
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Explainable Risk Audit Panel */}
        {isSidePanelOpen && (
          <div
            className="lg:col-span-5 xl:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden"
            style={{ height: '650px' }}
          >
            {selectedCell ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* Panel Header */}
                <div className="border-b border-gray-200 pb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-gray-900">
                        {selectedCell.areaName} Sector
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gray-100 text-gray-600 font-bold">
                        {selectedCell.cellId}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Centroid: {selectedCell.coordinates?.latitude?.toFixed(4)}° N, {selectedCell.coordinates?.longitude?.toFixed(4)}° E
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border ${
                        RISK_CONFIG[selectedCell.riskLevel]?.badge || 'bg-gray-100'
                      }`}
                    >
                      {RISK_CONFIG[selectedCell.riskLevel]?.icon} {selectedCell.riskLevel} Risk
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        CONFIDENCE_CONFIG[selectedCell.confidenceLabel]?.badge || 'bg-gray-100'
                      }`}
                    >
                      {selectedCell.confidenceLabel?.toUpperCase()} CONFIDENCE
                    </span>
                  </div>
                </div>

                {/* Prominent Score Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-3 rounded-xl border ${RISK_CONFIG[selectedCell.riskLevel]?.bg}`}>
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Waterlogging Risk
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-gray-950">
                        {selectedCell.waterloggingRisk}
                      </span>
                      <span className="text-xs text-gray-500 font-bold">/ 100</span>
                    </div>
                    <div className="text-[10px] mt-1 font-semibold text-gray-600">
                      Tier: {RISK_CONFIG[selectedCell.riskLevel]?.label}
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${CONFIDENCE_CONFIG[selectedCell.confidenceLabel]?.badge}`}>
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Evidence Confidence
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-gray-950">
                        {selectedCell.confidence}
                      </span>
                      <span className="text-xs text-gray-500 font-bold">/ 100</span>
                    </div>
                    <div className="text-[10px] mt-1 font-semibold text-gray-600 truncate">
                      {CONFIDENCE_CONFIG[selectedCell.confidenceLabel]?.label}
                    </div>
                  </div>
                </div>

                {/* Recommended Operational Action Box */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    getActionBadge(selectedCell.recommendedAction).color
                  } space-y-1`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs">
                    <span>{getActionBadge(selectedCell.recommendedAction).icon}</span>
                    <span>RECOMMENDED OPERATIONAL ACTION:</span>
                  </div>
                  <p className="text-[11px] font-semibold leading-relaxed">
                    {selectedCell.recommendedAction}
                  </p>
                  {selectedCell.suggestedResponseTime && (
                    <div className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded inline-block mt-1">
                      Suggested ETA: {selectedCell.suggestedResponseTime}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-500 pt-1 border-t border-black/10 flex items-center justify-between">
                    <span>Prediction Horizon: <strong>{selectedCell.predictionHorizon || 'next 3 hours'}</strong></span>
                    <span>Status: Inferred Estimate</span>
                  </div>
                  {onSwitchToPriorityDispatch && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={onSwitchToPriorityDispatch}
                        className="w-full py-1.5 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>🚨</span>
                        <span>Open in Priority Dispatch</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Recent & Forecast Rainfall Telemetry */}
                <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-950 flex items-center gap-1.5">
                      <span>🌧️</span>
                      <span>Precipitation Telemetry (Open-Meteo)</span>
                    </span>
                    <span className="text-[10px] font-mono text-sky-700 bg-white px-1.5 py-0.5 rounded border border-sky-200">
                      Live Stream
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-white p-2 rounded-lg border border-sky-100 shadow-2xs">
                      <div className="text-[10px] text-gray-500">Past 1h</div>
                      <div className="font-black text-sm text-sky-900">
                        {selectedCell.riskBreakdown?.recentRainfall?.metrics?.last1hMm?.toFixed(1) ?? '0.0'} mm
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-sky-100 shadow-2xs">
                      <div className="text-[10px] text-gray-500">Past 3h</div>
                      <div className="font-black text-sm text-sky-900">
                        {selectedCell.riskBreakdown?.recentRainfall?.metrics?.last3hMm?.toFixed(1) ?? '0.0'} mm
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-sky-100 shadow-2xs">
                      <div className="text-[10px] text-gray-500">Past 24h</div>
                      <div className="font-black text-sm text-sky-900">
                        {selectedCell.riskBreakdown?.recentRainfall?.metrics?.last24hMm?.toFixed(1) ?? '0.0'} mm
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-center pt-1">
                    <div className="bg-white/80 p-1.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-gray-500">Forecast Next 3h</div>
                      <div className="font-bold text-xs text-sky-800">
                        {selectedCell.riskBreakdown?.forecastRainfall?.metrics?.next3hMm?.toFixed(1) ?? '0.0'} mm
                      </div>
                    </div>
                    <div className="bg-white/80 p-1.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-gray-500">Forecast Next 6h</div>
                      <div className="font-bold text-xs text-sky-800">
                        {selectedCell.riskBreakdown?.forecastRainfall?.metrics?.next6hMm?.toFixed(1) ?? '0.0'} mm
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Sub-Score Factors Breakdown (Explainability) */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 flex items-center gap-1.5">
                      <span>⚖️</span>
                      <span>Risk Contribution Breakdown (100 Pts)</span>
                    </span>
                    <span className="text-[10px] text-gray-500">Weighted Fusion</span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div>
                      <div className="flex justify-between text-gray-700 mb-0.5">
                        <span>Recent Rainfall (30%)</span>
                        <strong className="font-mono">{selectedCell.riskBreakdown?.recentRainfall?.weightedContribution || 0} / 30 pts</strong>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${((selectedCell.riskBreakdown?.recentRainfall?.weightedContribution || 0) / 30) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-700 mb-0.5">
                        <span>Credible Citizen Reports (25%)</span>
                        <strong className="font-mono">{selectedCell.riskBreakdown?.credibleReports?.weightedContribution || 0} / 25 pts</strong>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-600 h-full rounded-full"
                          style={{ width: `${((selectedCell.riskBreakdown?.credibleReports?.weightedContribution || 0) / 25) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-700 mb-0.5">
                        <span>Duplicate Cluster Density (15%)</span>
                        <strong className="font-mono">{selectedCell.riskBreakdown?.duplicateCluster?.weightedContribution || 0} / 15 pts</strong>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${((selectedCell.riskBreakdown?.duplicateCluster?.weightedContribution || 0) / 15) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-700 mb-0.5">
                        <span>Historical Hotspot Baseline (15%)</span>
                        <strong className="font-mono">{selectedCell.riskBreakdown?.historicalHotspot?.weightedContribution || 0} / 15 pts</strong>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-600 h-full rounded-full"
                          style={{ width: `${((selectedCell.riskBreakdown?.historicalHotspot?.weightedContribution || 0) / 15) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-700 mb-0.5">
                        <span>Drainage Vulnerability (10%)</span>
                        <strong className="font-mono">{selectedCell.riskBreakdown?.drainageVulnerability?.weightedContribution || 0} / 10 pts</strong>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-600 h-full rounded-full"
                          style={{ width: `${((selectedCell.riskBreakdown?.drainageVulnerability?.weightedContribution || 0) / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-700 mb-0.5">
                        <span>Forecast Rain Projection (5%)</span>
                        <strong className="font-mono">{selectedCell.riskBreakdown?.forecastRainfall?.weightedContribution || 0} / 5 pts</strong>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-cyan-600 h-full rounded-full"
                          style={{ width: `${((selectedCell.riskBreakdown?.forecastRainfall?.weightedContribution || 0) / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evidence List */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-gray-900 flex items-center justify-between">
                    <span>📑 Explainable Evidence Factors:</span>
                    <span className="text-[10px] text-gray-500">{selectedCell.evidence?.length || 0} signals</span>
                  </h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                    {selectedCell.evidence?.map((ev, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px] text-gray-700 leading-snug">
                        <span className="text-cyan-600 shrink-0 font-bold">•</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Provenance & Source Badges */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-gray-900">🏷️ Data Provenance & Attribution:</h4>
                  <div className="space-y-1.5">
                    {selectedCell.provenance?.map((p, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-gray-200 rounded-xl p-2.5 flex items-start justify-between gap-2 shadow-2xs"
                      >
                        <div>
                          <div className="font-bold text-gray-900 text-[11px]">{p.source}</div>
                          <div className="text-[10px] text-gray-500 font-medium">{p.metric}</div>
                          <div className="text-[10px] text-gray-600 italic mt-0.5">{p.details}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                            p.isFallback ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.isFallback ? 'Proxy Baseline' : 'Live Stream'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Citizen Complaints Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900">
                      👥 Linked Ground Reports ({selectedCellLinkedGrievances.length}):
                    </h4>
                    <span className="text-[10px] text-gray-500">Within ~3.0 km catchment</span>
                  </div>

                  {selectedCellLinkedGrievances.length === 0 ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 text-center text-gray-400 text-[11px]">
                      No active citizen reports currently linked to this cell.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedCellLinkedGrievances.map((g) => (
                        <div
                          key={g.id}
                          className="bg-white border border-gray-200 hover:border-cyan-400 rounded-xl p-2.5 transition text-xs space-y-1.5"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-[10px] text-gray-500 font-bold">#{g.id.slice(0, 8)}</span>
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-800 font-bold rounded text-[10px]">
                              Urgency {g.urgency_score || 5}/10
                            </span>
                          </div>
                          <p className="text-gray-700 italic text-[11px] line-clamp-2">
                            "{g.text}"
                          </p>
                          <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-[10px]">
                            <span className="text-gray-500 truncate">📍 {g.address || g.location}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenStatusModal?.(g)}
                                className="text-emerald-600 font-bold hover:underline cursor-pointer"
                              >
                                Status
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectGrievance?.(g.id)}
                                className="text-blue-600 font-bold hover:underline cursor-pointer"
                              >
                                Inspect
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Final Mandatory Inferred Disclaimer */}
                <div className="p-2.5 bg-gray-100 rounded-xl border border-gray-200 text-[10px] text-gray-600 text-center italic">
                  "This is an inferred environmental-risk estimate, not a direct sensor measurement."
                </div>
              </div>
            ) : (
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
                <span className="text-3xl">🗺️</span>
                <p className="font-bold text-gray-700 text-sm">Select Any Risk Cell to Inspect</p>
                <p className="text-xs max-w-xs text-gray-500">
                  Click on any 500m grid cell or area badge on the map to audit its multi-source evidence, rainfall telemetry, and recommended action.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
