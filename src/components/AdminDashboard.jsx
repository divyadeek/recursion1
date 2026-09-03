import React, { useState, useEffect, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  listAllGrievances,
  getDuplicateClusters,
  updateClusterStatus,
  updateGrievanceStatus,
  uploadProgressPhoto,
  reclassifyGrievance,
  getAnalytics,
  getGrievance,
  getWeatherContext,
  getGrievanceCredibility,
} from '../services/api.js'
import AdminMapDashboard from './AdminMapDashboard.jsx'
import AdminFloodOpsMap from './AdminFloodOpsMap.jsx'
import AdminPriorityDispatch from './AdminPriorityDispatch.jsx'

/**
 * Reusable helper function to identify whether a grievance is relevant to FloodOps.
 * Returns true if:
 * 1. Category is 'waterlogging' or 'blocked_drain'
 * 2. Category is 'sanitation' AND the grievance text contains flood-related keywords:
 *    "drain", "sewage", "overflow", "stagnant water", "waterlogged", "flooding", "flood", "blocked drain"
 * Returns false otherwise.
 */
export function isFloodRelevantGrievance(grievance) {
  if (!grievance || !grievance.category) return false

  const cat = grievance.category
  if (cat === 'waterlogging' || cat === 'blocked_drain') {
    return true
  }

  if (cat === 'sanitation') {
    const text = (grievance.text || '').toLowerCase()
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

const CATEGORIES = [
  'water_supply',
  'electricity',
  'roads',
  'sanitation',
  'public_safety',
  'street_lights',
  'garbage_waste',
  'waterlogging',
  'blocked_drain',
  'out_of_scope',
]
const STATUSES = ['unsolved', 'in_progress', 'solved', 'rejected']

const STATUS_CONFIG = {
  unsolved: {
    label: 'UNSOLVED',
    bg: 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300/30',
    dot: 'bg-amber-500',
  },
  in_progress: {
    label: 'IN PROGRESS',
    bg: 'bg-blue-50 text-blue-900 border-blue-300 ring-1 ring-blue-300/30',
    dot: 'bg-blue-500',
  },
  solved: {
    label: 'SOLVED',
    bg: 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-300/30',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'REJECTED',
    bg: 'bg-rose-50 text-rose-900 border-rose-300 ring-1 ring-rose-300/30',
    dot: 'bg-rose-500',
  },
}

const CATEGORY_MAP = {
  water_supply: 'Water Supply',
  electricity: 'Electricity',
  roads: 'Roads',
  sanitation: 'Sanitation',
  public_safety: 'Safety',
  street_lights: 'Street Lights',
  garbage_waste: 'Garbage',
  waterlogging: 'Waterlogging / Flooding',
  blocked_drain: 'Blocked Drain / Sewage Overflow',
  out_of_scope: 'Out of Scope',
}

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

const PIE_COLORS = [
  '#0284c7', // sky-600
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#6366f1', // indigo-500
  '#ec4899', // pink-500
  '#8b5cf6', // violet-500
  '#14b8a6', // teal-500
  '#0ea5e9', // cyan-500
  '#f97316', // orange-500
  '#94a3b8', // slate-400
]

export default function AdminDashboard({ showToast }) {
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'clusters' | 'analytics'
  const [grievances, setGrievances] = useState([])
  const [clusters, setClusters] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [filters, setFilters] = useState({ category: '', status: '', min_urgency: '', search: '' })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [selectedGrievance, setSelectedGrievance] = useState(null)

  // Status update modal state (for individual grievance)
  const [statusModalGrievance, setStatusModalGrievance] = useState(null)
  const [newStatus, setNewStatus] = useState('in_progress')
  const [statusNote, setStatusNote] = useState('')
  const [progressPhoto, setProgressPhoto] = useState(null)
  const [updateClusterCascade, setUpdateClusterCascade] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Full-size image preview modal state
  const [previewImageModal, setPreviewImageModal] = useState(null)

  // Cluster bulk resolution modal state
  const [clusterModalTarget, setClusterModalTarget] = useState(null)
  const [clusterNewStatus, setClusterNewStatus] = useState('in_progress')
  const [clusterNote, setClusterNote] = useState('')
  const [clusterPhoto, setClusterPhoto] = useState(null)
  const [updatingCluster, setUpdatingCluster] = useState(false)

  // Expand full complaint text in table
  const [expandedTexts, setExpandedTexts] = useState({})
  const toggleExpandText = (id) => {
    setExpandedTexts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Weather context state cached by grievance ID: { [id]: { data, loading, error, noLocation } }
  const [weatherByGrievanceId, setWeatherByGrievanceId] = useState({})

  // Expand table row details inline
  const [expandedRows, setExpandedRows] = useState({})

  const fetchWeatherForGrievance = useCallback(async (g, force = false) => {
    if (!g || !g.id) return

    // Show weather context ONLY for flood-relevant grievances
    if (!isFloodRelevantGrievance(g)) return

    // Check component state cache if not forcing refresh
    if (!force) {
      const cached = weatherByGrievanceId[g.id]
      if (cached && (cached.data || cached.loading || cached.noLocation)) {
        return
      }
    }

    const rawLat = g.latitude
    const rawLon = g.longitude
    const lat = typeof rawLat === 'number' ? rawLat : (rawLat !== null && rawLat !== undefined && rawLat !== '' ? parseFloat(rawLat) : NaN)
    const lon = typeof rawLon === 'number' ? rawLon : (rawLon !== null && rawLon !== undefined && rawLon !== '' ? parseFloat(rawLon) : NaN)

    const hasValidCoords = !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180

    // Edge case: No precise location available
    if (!hasValidCoords) {
      setWeatherByGrievanceId((prev) => ({
        ...prev,
        [g.id]: {
          data: null,
          loading: false,
          noLocation: true,
          error: null,
        },
      }))
      return
    }

    setWeatherByGrievanceId((prev) => ({
      ...prev,
      [g.id]: {
        data: null,
        loading: true,
        noLocation: false,
        error: null,
      },
    }))

    try {
      const res = await getWeatherContext(lat, lon)
      setWeatherByGrievanceId((prev) => ({
        ...prev,
        [g.id]: {
          data: res.data,
          loading: false,
          noLocation: false,
          error: null,
        },
      }))
    } catch (err) {
      setWeatherByGrievanceId((prev) => ({
        ...prev,
        [g.id]: {
          data: null,
          loading: false,
          noLocation: false,
          error: err?.response?.data?.detail || 'Weather context is temporarily unavailable.',
        },
      }))
    }
  }, [weatherByGrievanceId])

  const toggleRowExpansion = (g) => {
    setExpandedRows((prev) => {
      const next = !prev[g.id]
      if (next && isFloodRelevantGrievance(g)) {
        fetchWeatherForGrievance(g)
      }
      return { ...prev, [g.id]: next }
    })
  }

  const loadData = useCallback(() => {
    setLoading(true)
    const params = {}
    if (filters.category) params.category = filters.category
    if (filters.status) params.status = filters.status
    if (filters.min_urgency) params.min_urgency = filters.min_urgency

    Promise.all([listAllGrievances(params), getDuplicateClusters(), getAnalytics()])
      .then(([gRes, cRes, aRes]) => {
        let list = gRes.data || []
        if (filters.search) {
          const s = filters.search.toLowerCase()
          list = list.filter(
            (g) =>
              g.text.toLowerCase().includes(s) ||
              (g.location && g.location.toLowerCase().includes(s)) ||
              (g.department && g.department.toLowerCase().includes(s)) ||
              (g.user_phone && g.user_phone.toLowerCase().includes(s)) ||
              (g.user_email && g.user_email.toLowerCase().includes(s))
          )
        }
        setGrievances(list)
        setClusters(cRes.data || [])
        setAnalytics(aRes.data)
      })
      .catch(() => showToast?.('Failed to load dashboard data', 'error'))
      .finally(() => setLoading(false))
  }, [filters, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openStatusUpdateModal = (g) => {
    setStatusModalGrievance(g)
    setNewStatus(g.status)
    setStatusNote('')
    setProgressPhoto(null)
    setUpdateClusterCascade(g.is_duplicate)
  }

  const handleSaveStatusWithPhoto = async (e) => {
    e.preventDefault()
    if (!statusModalGrievance) return

    setUpdatingStatus(true)
    try {
      let progressImageUrl = null
      if (progressPhoto) {
        const formData = new FormData()
        formData.append('progress_image', progressPhoto)
        const photoRes = await uploadProgressPhoto(statusModalGrievance.id, formData)
        progressImageUrl = photoRes.data?.progress_image_url
      }

      const res = await updateGrievanceStatus(statusModalGrievance.id, {
        status: newStatus,
        message: statusNote || `Status updated to ${newStatus.toUpperCase()}`,
        progress_image_url: progressImageUrl,
        update_cluster: updateClusterCascade,
      })

      const notifiedCount = res.data?.notified_citizens?.length || 1
      showToast(`Status updated to ${newStatus.toUpperCase()}! SMS dispatched to ${notifiedCount} citizen(s).`)
      setStatusModalGrievance(null)
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleClusterBulkUpdate = async (e) => {
    e.preventDefault()
    if (!clusterModalTarget) return

    setUpdatingCluster(true)
    try {
      let progressImageUrl = null
      if (clusterPhoto) {
        const formData = new FormData()
        formData.append('progress_image', clusterPhoto)
        const photoRes = await uploadProgressPhoto(clusterModalTarget.cluster_id, formData)
        progressImageUrl = photoRes.data?.progress_image_url
      }

      const res = await updateClusterStatus(clusterModalTarget.cluster_id, {
        status: clusterNewStatus,
        message: clusterNote || `Cluster resolved to ${clusterNewStatus.toUpperCase()}`,
        progress_image_url: progressImageUrl,
      })

      showToast(`Cluster updated! ${res.data?.message || 'SMS dispatched to all citizens in cluster.'}`)
      setClusterModalTarget(null)
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Cluster update failed', 'error')
    } finally {
      setUpdatingCluster(false)
    }
  }

  const handleReclassify = async (id, category) => {
    try {
      await reclassifyGrievance(id, { category })
      showToast('Grievance reclassified & department reassigned')
      setEditing(null)
      loadData()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Reclassify failed', 'error')
    }
  }

  const viewDetails = async (id) => {
    try {
      const res = await getGrievance(id)
      const g = res.data
      setSelectedGrievance(g)
      if (isFloodRelevantGrievance(g)) {
        fetchWeatherForGrievance(g)
      }
    } catch {
      showToast('Could not load grievance details', 'error')
    }
  }

  const totalDuplicateComplaints = clusters.reduce((acc, c) => acc + (c.complaints?.length || 0), 0)

  // Chart data preparations
  const categoryPieData = analytics?.by_category
    ? Object.entries(analytics.by_category)
        .filter(([_, count]) => count > 0)
        .map(([cat, count]) => ({
          name: CATEGORY_MAP[cat] || cat,
          value: count,
        }))
    : []

  const statusMetricsData = analytics?.by_status
    ? [
        { name: 'Solved', count: analytics.by_status.solved || 0, fill: '#10b981' },
        { name: 'In Progress', count: analytics.by_status.in_progress || 0, fill: '#3b82f6' },
        { name: 'Unsolved', count: analytics.by_status.unsolved || 0, fill: '#f59e0b' },
        { name: 'Rejected', count: analytics.by_status.rejected || 0, fill: '#f43f5e' },
      ]
    : []

  const resolutionTrendData = analytics?.resolution_timeline || [
    { period: 'Day -6', avg_hours: 36 },
    { period: 'Day -5', avg_hours: 32 },
    { period: 'Day -4', avg_hours: 28 },
    { period: 'Day -3', avg_hours: 22 },
    { period: 'Day -2', avg_hours: 19 },
    { period: 'Yesterday', avg_hours: 16 },
    { period: 'Today', avg_hours: analytics?.avg_resolution_hours || 14 },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header / Analytics Overview Cards */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Grievances"
            value={analytics.total_grievances}
            icon="📋"
            onClick={() => setActiveTab('all')}
          />
          <StatCard
            label="Duplicates"
            value={`${clusters.length} (${totalDuplicateComplaints} total)`}
            icon="👥"
            subtext="Click to inspect all merged groups"
            highlight={clusters.length > 0}
            onClick={() => setActiveTab('clusters')}
          />
          <StatCard
            label="Avg. Resolution Time"
            value={analytics.avg_resolution_hours ? `${analytics.avg_resolution_hours.toFixed(1)}h` : '—'}
            icon="⏱️"
            onClick={() => setActiveTab('analytics')}
          />
          <StatCard
            label="Solved Complaints"
            value={analytics.by_status?.solved || 0}
            icon="✅"
            subtext={`${analytics.by_status?.in_progress || 0} currently in progress`}
            onClick={() => {
              setFilters((f) => ({ ...f, status: 'solved' }))
              setActiveTab('all')
            }}
          />
        </div>
      )}

      {/* Main Admin Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-2xl shadow-xs px-5 pt-3 gap-4 sm:gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'all'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-xl">📋</span>
          <span>All Grievances</span>
          <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
            {grievances.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('clusters')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'clusters'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-xl">👥</span>
          <span>Duplicates</span>
          <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-300">
            {clusters.length} clusters ({totalDuplicateComplaints})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'analytics'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-xl">📊</span>
          <span>Analytics</span>
        </button>

        <button
          id="btn-tab-admin-map"
          onClick={() => setActiveTab('map')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'map'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-xl">🗺️</span>
          <span>Complaint Map</span>
          <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
            {grievances.filter((g) => g.latitude && g.longitude).length} mapped
          </span>
        </button>

        <button
          id="btn-tab-floodops-map"
          onClick={() => setActiveTab('floodops_map')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'floodops_map'
              ? 'border-cyan-600 text-cyan-700 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-xl">🌊</span>
          <span>FloodOps Map</span>
          <span className="bg-cyan-100 text-cyan-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-cyan-200">
            500m Risk Grid
          </span>
        </button>

        <button
          id="btn-tab-priority-dispatch"
          onClick={() => setActiveTab('priority_dispatch')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'priority_dispatch'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-xl">🚨</span>
          <span>Priority Dispatch</span>
          <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-purple-200">
            Operations
          </span>
        </button>
      </div>

      {/* TAB 1: ALL GRIEVANCES TABLE */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[14rem]">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Search</label>
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
              />
            </div>

            <FilterSelect
              label="Category"
              value={filters.category}
              onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
              options={CATEGORIES}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              options={STATUSES}
            />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Min Urgency</label>
              <input
                type="number"
                min={1}
                max={10}
                value={filters.min_urgency}
                onChange={(e) => setFilters((f) => ({ ...f, min_urgency: e.target.value }))}
                placeholder="1-10"
                className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm w-24 bg-white shadow-xs"
              />
            </div>
            <button
              onClick={loadData}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold cursor-pointer transition shadow-xs"
            >
              Apply
            </button>
            {(filters.category || filters.status || filters.min_urgency || filters.search) && (
              <button
                onClick={() => setFilters({ category: '', status: '', min_urgency: '', search: '' })}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold cursor-pointer transition"
              >
                Clear
              </button>
            )}
          </div>

          {/* Grievance Table (No horizontal scrolling layout) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left table-auto">
              <thead className="bg-gray-50/90 text-gray-800 border-b border-gray-200 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-4/12">Complaint</th>
                  <th className="px-3 py-3.5 w-2/12">Identity</th>
                  <th className="px-3 py-3.5 w-2/12">Category</th>
                  <th className="px-2 py-3.5 text-center w-1/12">Urgency</th>
                  <th className="px-2 py-3.5 text-center w-1/12">Status</th>
                  <th className="px-2 py-3.5 text-center w-1/12">Duplicates</th>
                  <th className="px-4 py-3.5 text-right w-1/12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm font-medium">
                      <span className="animate-spin inline-block mr-2 text-xl">⚙️</span> Loading grievances...
                    </td>
                  </tr>
                )}
                {!loading && grievances.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm font-medium">
                      No grievances match the specified criteria.
                    </td>
                  </tr>
                )}
                {grievances.map((g) => {
                  const statusInfo = STATUS_CONFIG[g.status] || {
                    label: g.status?.toUpperCase(),
                    bg: 'bg-gray-100 text-gray-800 border-gray-300',
                    dot: 'bg-gray-400',
                  }

                  return (
                    <React.Fragment key={g.id}>
                      <tr className="hover:bg-gray-50/70 transition align-top">
                        {/* Complaint Details & Location */}
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-start gap-1.5">
                              <p
                                className={`font-semibold text-gray-900 text-sm sm:text-base leading-snug break-words flex-1 ${
                                  expandedTexts[g.id] ? '' : 'line-clamp-2'
                                }`}
                              >
                                {g.text}
                              </p>
                              {g.text && g.text.length > 60 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandText(g.id)}
                                  title={expandedTexts[g.id] ? 'Collapse text' : 'Expand full complaint'}
                                  className="shrink-0 p-1 hover:bg-gray-200 rounded-lg text-gray-600 text-xs font-bold transition cursor-pointer"
                                >
                                  {expandedTexts[g.id] ? '▲' : '▼'}
                                </button>
                              )}
                            </div>

                            {g.location && (
                              <p className="text-xs sm:text-sm text-brand-700 font-medium flex items-start gap-1 pt-0.5">
                                <span className="shrink-0">📍</span>
                                <span className="break-words">{g.location}</span>
                              </p>
                            )}

                            <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-gray-400">
                              <span>#{g.id.slice(0, 6)}</span>
                              <span>·</span>
                              <span>{new Date(g.created_at).toLocaleDateString()}</span>
                              {g.image_url && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImageModal({
                                      url: g.image_url,
                                      title: `Grievance #${g.id.slice(0, 6)} - Citizen Photo`,
                                      caption: g.text,
                                      location: g.location,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300 font-bold cursor-pointer transition shadow-xs ml-1"
                                >
                                  <span>📸 Photo</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Identity */}
                        <td className="px-3 py-4">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-gray-900 break-words">
                              {g.user_phone ? `📞 ${g.user_phone}` : '📞 Unverified'}
                            </p>
                            {g.user_email && <p className="text-xs text-gray-500 truncate max-w-[9rem]">{g.user_email}</p>}
                            <span className="inline-block text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md border border-gray-200">
                              Reputation: {g.user_reputation ?? 100}
                            </span>
                          </div>
                        </td>

                        {/* Category & Inline Edit Button */}
                        <td className="px-3 py-4">
                          {editing === g.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                defaultValue={g.category}
                                onChange={(e) => handleReclassify(g.id, e.target.value)}
                                className="border border-brand-400 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none shadow-xs font-semibold"
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {CATEGORY_MAP[c] || c}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => setEditing(null)}
                                className="text-xs text-gray-500 hover:text-gray-800 p-1 font-bold cursor-pointer"
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-base">{CATEGORY_ICONS[g.category] || '🏛️'}</span>
                                <span className="font-bold text-sm text-gray-900 uppercase">
                                  {CATEGORY_MAP[g.category] || g.category?.replace('_', ' ')}
                                </span>
                                <button
                                  onClick={() => setEditing(g.id)}
                                  title="Edit Category / Reclassify"
                                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-brand-600 transition cursor-pointer text-xs"
                                >
                                  ✏️
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 font-medium">{g.department || 'General'}</p>
                            </div>
                          )}
                        </td>

                        {/* Urgency Score */}
                        <td className="px-2 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              g.urgency_score >= 8
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : g.urgency_score >= 5
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {g.urgency_score}/10
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-2 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${statusInfo.bg}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                            <span>{statusInfo.label}</span>
                          </span>
                        </td>

                        {/* Duplicates */}
                        <td className="px-2 py-4 text-center">
                          {g.is_duplicate ? (
                            <button
                              onClick={() => {
                                const found = clusters.find(
                                  (c) =>
                                    c.cluster_id === g.id ||
                                    c.complaints?.some((cmp) => cmp.id === g.id)
                                )
                                if (found) {
                                  setClusterModalTarget(found)
                                  setClusterNewStatus(found.status)
                                } else {
                                  setActiveTab('clusters')
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 transition cursor-pointer shadow-xs"
                              title="Click to view merged duplicate reports"
                            >
                              <span>👥</span>
                              <span>({g.similar_complaint_ids?.length ? g.similar_complaint_ids.length + 1 : 2})</span>
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Action Buttons: Update and Details */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openStatusUpdateModal(g)}
                              className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition flex items-center gap-1"
                            >
                              <span>Update</span>
                            </button>
                            <button
                              onClick={() => toggleRowExpansion(g)}
                              className="px-2.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition flex items-center gap-1"
                              title={expandedRows[g.id] ? 'Collapse row details' : 'Expand grievance details'}
                            >
                              <span>{expandedRows[g.id] ? '▲ Details' : '▼ Details'}</span>
                            </button>
                            <button
                              onClick={() => viewDetails(g.id)}
                              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition flex items-center gap-1"
                              title="Open full grievance details and timeline modal"
                            >
                              <span>Timeline</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Row Details View */}
                      {expandedRows[g.id] && (
                        <tr className="bg-slate-50/70 border-b border-gray-200">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                                <div>
                                  <span className="font-bold text-gray-900">Citizen Contact:</span>{' '}
                                  {g.user_phone || 'Unverified'} {g.user_email ? `(${g.user_email})` : ''} ·{' '}
                                  <span className="font-bold text-gray-900 ml-1">Reputation:</span>{' '}
                                  {g.user_reputation ?? 100}/100 ·{' '}
                                  <span className="font-bold text-gray-900 ml-1">Reported:</span>{' '}
                                  {new Date(g.created_at).toLocaleString()}
                                </div>
                                {g.location && (
                                  <div className="font-semibold text-brand-800">
                                    📍 {g.location}
                                  </div>
                                )}
                              </div>

                              {/* Report Credibility Assessment Card (flood-relevant only) */}
                              {isFloodRelevantGrievance(g) && (
                                <ReportCredibilityCard
                                  grievance={g}
                                  weatherState={weatherByGrievanceId[g.id]}
                                />
                              )}

                              {/* Environmental Weather Context Card (flood-relevant only) */}
                              {isFloodRelevantGrievance(g) && (
                                <EnvironmentalContextCard
                                  grievance={g}
                                  weatherState={weatherByGrievanceId[g.id]}
                                  onRetry={() => fetchWeatherForGrievance(g, true)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DUPLICATES */}
      {activeTab === 'clusters' && (
        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900 flex items-start gap-3 shadow-xs">
            <span className="text-3xl">👥</span>
            <div>
              <h3 className="font-bold text-base text-amber-950 mb-1">
                Duplicates Management
              </h3>
              <p className="leading-relaxed">
                When multiple citizens submit complaints regarding the exact same incident, they are grouped into a cluster. Updating the status here automatically sends SMS notifications to every citizen who filed a report in this cluster.
              </p>
            </div>
          </div>

          {clusters.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-500">
              <p className="text-4xl mb-2">🎉</p>
              <p className="font-bold text-base text-gray-800">No duplicate complaints detected.</p>
              <p className="text-sm text-gray-500 mt-1">All complaints filed are distinct issues across different locations.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {clusters.map((c, idx) => (
                <div
                  key={c.cluster_id || idx}
                  className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden"
                >
                  {/* Cluster Header */}
                  <div className="bg-amber-50/50 p-5 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <span className="text-3xl">{CATEGORY_ICONS[c.category] || '🏛️'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-gray-900">{CATEGORY_MAP[c.category] || c.category}</span>
                          <span className="text-sm text-gray-500">· {c.department}</span>
                          <span className="bg-amber-200 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            {c.total_complaints} Citizen Reports
                          </span>
                        </div>
                        <p className="text-sm text-brand-800 font-medium mt-0.5 flex items-center gap-1">
                          <span>📍</span> {c.location}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                          STATUS_CONFIG[c.status]?.bg || 'bg-gray-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[c.status]?.dot || 'bg-gray-400'}`} />
                        <span>{STATUS_CONFIG[c.status]?.label || c.status?.toUpperCase()}</span>
                      </span>

                      <button
                        onClick={() => {
                          setClusterModalTarget(c)
                          setClusterNewStatus(c.status)
                          setClusterNote('')
                          setClusterPhoto(null)
                        }}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold cursor-pointer transition shadow-xs flex items-center gap-2"
                      >
                        <span>📢 Resolve & Broadcast SMS ({c.total_complaints})</span>
                      </button>
                    </div>
                  </div>

                  {/* List of citizen reports in this cluster */}
                  <div className="p-5 space-y-3">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Citizens who reported this incident:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {c.complaints?.map((cmp, cIdx) => (
                        <div
                          key={cmp.id || cIdx}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs sm:text-sm space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-gray-900">
                                {cmp.user_phone ? `📞 ${cmp.user_phone}` : '📞 Citizen'}
                              </p>
                              {cmp.user_email && <p className="text-xs text-gray-500">{cmp.user_email}</p>}
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                STATUS_CONFIG[cmp.status]?.bg || 'bg-gray-100'
                              }`}
                            >
                              {cmp.status?.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-gray-800 bg-white p-3 rounded-lg border border-gray-100 font-medium">
                            "{cmp.text}"
                          </p>

                          {cmp.image_url && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImageModal({
                                    url: cmp.image_url,
                                    title: `Cluster Report #${cmp.id?.slice(0, 6)}`,
                                    caption: cmp.text,
                                    location: c.location,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300 font-bold cursor-pointer transition"
                              >
                                <img
                                  src={cmp.image_url}
                                  alt="Photo Evidence"
                                  className="w-5 h-5 rounded object-cover"
                                />
                                <span>📸 View Attached Photo</span>
                              </button>
                            </div>
                          )}

                          <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
                            <span>Reputation: {cmp.user_reputation ?? 100}</span>
                            <span>Reported: {new Date(cmp.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ANALYTICS */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Charts Row 1: Pie Chart (Category) & Bar Chart (Resolution Metrics) */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pie Chart: Grievances by Category */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">🥧</span>
                  <span>Grievances by Category</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Distribution of reported municipal issues across departments</p>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {categoryPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} grievances`, name]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Resolution Metrics */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <span>Resolution Metrics</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Current grievance resolution stage volume</p>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusMetricsData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip
                      formatter={(val) => [`${val} grievances`, 'Count']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {statusMetricsData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Line Chart for Average Time to Resolve Issues */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">⏱️</span>
                  <span>Average Time to Resolve Issues (Hours)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Average turnaround time trend for resolving citizen grievances</p>
              </div>
              <div className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold">
                Current Avg: {analytics.avg_resolution_hours ? `${analytics.avg_resolution_hours.toFixed(1)}h` : '18.5h'}
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={resolutionTrendData} margin={{ top: 10, right: 30, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} unit="h" />
                  <Tooltip
                    formatter={(val) => [`${val} hours`, 'Avg Resolution Time']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_hours"
                    name="Avg Hours"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0284c7', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTERACTIVE GIS MAP VIEW (Complaint Map) */}
      {activeTab === 'map' && (
        <AdminMapDashboard
          grievances={grievances}
          onSelectGrievance={viewDetails}
          onOpenStatusModal={openStatusUpdateModal}
          onPreviewPhoto={(url) => setPreviewImageModal(url)}
          onSwitchToFloodOpsMap={() => setActiveTab('floodops_map')}
        />
      )}

      {/* TAB 5: FLOODOPS MAP (Inundation Risk Grid) */}
      {activeTab === 'floodops_map' && (
        <AdminFloodOpsMap
          grievances={grievances}
          onSelectGrievance={viewDetails}
          onOpenStatusModal={openStatusUpdateModal}
          onSwitchToComplaintMap={() => setActiveTab('map')}
          onSwitchToPriorityDispatch={() => setActiveTab('priority_dispatch')}
        />
      )}

      {/* TAB 6: PRIORITY DISPATCH OPERATIONS TABLE */}
      {activeTab === 'priority_dispatch' && (
        <AdminPriorityDispatch
          onNavigateToFloodOpsMap={() => setActiveTab('floodops_map')}
          onSelectGrievance={viewDetails}
        />
      )}

      {/* MODAL 1: Update Single Grievance Status & Dispatch SMS */}
      {statusModalGrievance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Update Grievance Status</h3>
                <p className="text-xs text-gray-500">
                  Update resolution step, log field notes, attach photo, and dispatch SMS.
                </p>
              </div>
              <button
                onClick={() => setStatusModalGrievance(null)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Citizen Contact Card */}
            <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-3.5 mb-4 text-xs">
              <p className="font-bold text-brand-950 mb-1">👤 Citizen Filer Information:</p>
              <div className="grid grid-cols-2 gap-2 text-brand-900 font-medium">
                <div>
                  <span className="text-gray-500">Phone:</span>{' '}
                  <strong className="text-gray-900">{statusModalGrievance.user_phone || 'Unverified'}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>{' '}
                  <span className="text-gray-900">{statusModalGrievance.user_email || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Reputation:</span>{' '}
                  <strong>{statusModalGrievance.user_reputation ?? 100}/100</strong>
                </div>
                <div>
                  <span className="text-gray-500">ID:</span> #{statusModalGrievance.id.slice(0, 6)}
                </div>
              </div>
            </div>

            {/* Full Complaint Statement */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 mb-4 text-xs">
              <p className="font-bold text-gray-800 mb-1 flex items-center justify-between">
                <span>📝 Complaint Statement:</span>
                <span className="text-[11px] font-bold text-brand-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                  {CATEGORY_MAP[statusModalGrievance.category] || statusModalGrievance.category}
                </span>
              </p>
              <p className="text-gray-900 font-medium leading-relaxed bg-white p-3 rounded-lg border border-gray-200">
                "{statusModalGrievance.text}"
              </p>
              {statusModalGrievance.location && (
                <p className="text-xs text-brand-800 font-semibold mt-2 flex items-center gap-1">
                  <span>📍 Location:</span>
                  <span>{statusModalGrievance.location}</span>
                </p>
              )}
            </div>

            <form onSubmit={handleSaveStatusWithPhoto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">New Resolution Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
                >
                  <option value="unsolved">⏳ Unsolved (Pending Inspection)</option>
                  <option value="in_progress">⚙️ In Progress (Field Team Dispatched)</option>
                  <option value="solved">✅ Solved (Work Completed)</option>
                  <option value="rejected">❌ Rejected (Out of Scope / False)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Status Message / Field Note
                </label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Repair crew has sealed the water main valve. Road repaving scheduled for tomorrow 10 AM."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  📸 Attach Progress Photo (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProgressPhoto(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600"
                />
              </div>

              {/* Duplicate cluster cascade toggle */}
              {statusModalGrievance.is_duplicate && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <label className="flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateClusterCascade}
                      onChange={(e) => setUpdateClusterCascade(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      Broadcast & update all {statusModalGrievance.similar_complaint_ids?.length || 1} other linked citizen complaints in this duplicate cluster
                    </span>
                  </label>
                </div>
              )}

              {/* Live SMS dispatch preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
                <p className="font-semibold mb-0.5">📲 Automated SMS Dispatch Preview:</p>
                <p className="italic text-blue-800">
                  "Status updated to {newStatus.toUpperCase()}
                  {statusNote ? `: ${statusNote}` : ''}"
                </p>
                <p className="text-[11px] text-blue-600 mt-1">
                  Recipient: <strong>{statusModalGrievance.user_phone || 'Citizen'}</strong>
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalGrievance(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center gap-1.5"
                >
                  {updatingStatus ? 'Dispatching SMS & Updating…' : 'Save Status & Notify Citizen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Cluster Resolution & SMS Broadcast */}
      {clusterModalTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Resolve Duplicate Cluster ({clusterModalTarget.total_complaints} Citizens)
                </h3>
                <p className="text-xs text-gray-500">
                  Update status and broadcast SMS notifications to all filers who reported this issue.
                </p>
              </div>
              <button
                onClick={() => setClusterModalTarget(null)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List of Filers to be Notified */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 text-xs">
              <p className="font-bold text-amber-950 mb-1.5">
                👥 SMS Will Be Dispatched To All {clusterModalTarget.complaints?.length} Citizens:
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {clusterModalTarget.complaints?.map((cmp, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/80 px-2.5 py-1.5 rounded-lg">
                    <span className="font-bold text-gray-900">
                      📞 {cmp.user_phone || 'Citizen'}
                    </span>
                    <span className="text-gray-500">{cmp.user_email || '—'}</span>
                    <span className="text-[11px] text-gray-400 font-semibold">Score: {cmp.user_reputation ?? 100}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleClusterBulkUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">New Resolution Status</label>
                <select
                  value={clusterNewStatus}
                  onChange={(e) => setClusterNewStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
                >
                  <option value="unsolved">⏳ Unsolved (Pending Inspection)</option>
                  <option value="in_progress">⚙️ In Progress (Field Team Dispatched)</option>
                  <option value="solved">✅ Solved (Work Completed for All Reports)</option>
                  <option value="rejected">❌ Rejected (Out of Scope / False)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Resolution Note / Field Update Message
                </label>
                <textarea
                  rows={3}
                  value={clusterNote}
                  onChange={(e) => setClusterNote(e.target.value)}
                  placeholder="e.g. Municipal road team has patched the pothole and cleared traffic barriers."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  📸 Field Progress / Completion Photo (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setClusterPhoto(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setClusterModalTarget(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingCluster}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
                >
                  {updatingCluster ? 'Broadcasting SMS…' : `Broadcast Update to All ${clusterModalTarget.total_complaints} Citizens`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: View Grievance Timeline Audit */}
      {selectedGrievance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_CONFIG[selectedGrievance.status]?.bg || 'bg-gray-100'
                  }`}
                >
                  {STATUS_CONFIG[selectedGrievance.status]?.label || selectedGrievance.status?.toUpperCase()}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-2">
                  {selectedGrievance.category?.replace('_', ' ')} · {selectedGrievance.department}
                </h3>
              </div>
              <button
                onClick={() => setSelectedGrievance(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filer Information */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs mb-3 flex flex-wrap justify-between gap-2 font-medium">
              <div>
                <span className="text-gray-500">Citizen Phone:</span>{' '}
                <strong className="text-gray-900">{selectedGrievance.user_phone || 'Unverified'}</strong>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>{' '}
                <span className="text-gray-900">{selectedGrievance.user_email || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Reputation:</span>{' '}
                <strong>{selectedGrievance.user_reputation ?? 100}</strong>
              </div>
            </div>

            <p className="text-sm text-gray-800 bg-gray-50 p-3.5 rounded-xl border border-gray-200 mb-3 font-medium">
              {selectedGrievance.text}
            </p>
            {selectedGrievance.location && (
              <p className="text-xs font-semibold text-gray-600 mb-3">📍 Location: {selectedGrievance.location}</p>
            )}

            {/* Report Credibility Assessment for flood-relevant complaints */}
            {isFloodRelevantGrievance(selectedGrievance) && (
              <ReportCredibilityCard
                grievance={selectedGrievance}
                weatherState={weatherByGrievanceId[selectedGrievance.id]}
              />
            )}

            {/* Environmental Weather Context for flood-relevant complaints */}
            {isFloodRelevantGrievance(selectedGrievance) && (
              <EnvironmentalContextCard
                grievance={selectedGrievance}
                weatherState={weatherByGrievanceId[selectedGrievance.id]}
                onRetry={() => fetchWeatherForGrievance(selectedGrievance, true)}
              />
            )}

            {selectedGrievance.image_url && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-700 mb-1.5">Citizen's Uploaded Photo:</p>
                <img
                  src={selectedGrievance.image_url}
                  alt="Original"
                  onClick={() =>
                    setPreviewImageModal({
                      url: selectedGrievance.image_url,
                      title: `Grievance #${selectedGrievance.id.slice(0, 6)}`,
                      caption: selectedGrievance.text,
                      location: selectedGrievance.location,
                    })
                  }
                  className="h-44 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 transition shadow-xs"
                />
              </div>
            )}

            {/* Updates Timeline */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3">🛠️ Audit Updates & Field Progress:</h4>
              {selectedGrievance.updates?.length === 0 ? (
                <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-xl">No updates logged yet.</p>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-gray-200">
                  {selectedGrievance.updates?.map((up) => (
                    <div key={up.id} className="relative pl-8">
                      <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-brand-600 border-2 border-white" />
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs space-y-1.5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-800 uppercase">{up.status}</span>
                          <span className="text-gray-500">{new Date(up.timestamp).toLocaleString()}</span>
                        </div>
                        {up.message && <p className="text-gray-800 font-medium">{up.message}</p>}
                        {up.progress_image_url && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs font-bold text-emerald-800 mb-1">📸 Progress Photo:</p>
                            <img
                              src={up.progress_image_url}
                              alt="Progress"
                              className="h-32 object-cover rounded-xl border border-gray-300 cursor-pointer"
                              onClick={() => setPreviewImageModal({ url: up.progress_image_url, title: 'Field Progress' })}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedGrievance(null)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Full-Screen Image Lightbox */}
      {previewImageModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  {previewImageModal.title || '📸 Photo Evidence'}
                </h3>
                {previewImageModal.location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <span>📍</span> {previewImageModal.location}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="text-gray-500 hover:text-gray-900 text-xl font-bold p-1 cursor-pointer rounded-lg hover:bg-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Lightbox Image Body */}
            <div className="p-4 bg-gray-950 flex items-center justify-center overflow-auto max-h-[65vh]">
              <img
                src={previewImageModal.url}
                alt="Grievance Evidence Full"
                className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg border border-gray-800"
              />
            </div>

            {/* Lightbox Footer Caption */}
            {previewImageModal.caption && (
              <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-700">
                <p className="font-bold text-gray-900 mb-0.5">Reported Complaint Description:</p>
                <p className="italic bg-white p-2.5 rounded-lg border border-gray-200 font-medium">
                  "{previewImageModal.caption}"
                </p>
              </div>
            )}

            <div className="p-3.5 bg-gray-100 border-t border-gray-200 flex justify-between items-center text-xs">
              <a
                href={previewImageModal.url}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 font-bold hover:underline flex items-center gap-1"
              >
                🔗 Open Original in New Tab
              </a>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, subtext, highlight, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm p-4 sm:p-5 border transition cursor-pointer ${
        highlight ? 'border-amber-400 ring-2 ring-amber-300/30' : 'border-gray-100 hover:border-brand-300'
      }`}
    >
      <div className="flex justify-between items-start">
        <p className="text-xs sm:text-sm font-semibold text-gray-500">{label}</p>
        <span className="text-xl sm:text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-black text-gray-900 mt-1.5">{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1 font-medium">{subtext}</p>}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm min-w-[9rem] focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white shadow-xs font-medium"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {CATEGORY_MAP[o] || o.replace('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  )
}

const CREDIBILITY_CONFIG = {
  verified_evidence: {
    label: 'Verified Evidence',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    barColor: 'bg-emerald-600',
    icon: '🛡️',
  },
  likely_credible: {
    label: 'Likely Credible',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    barColor: 'bg-blue-600',
    icon: '🔷',
  },
  needs_verification: {
    label: 'Needs Verification',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    barColor: 'bg-amber-500',
    icon: '⚠️',
  },
  insufficient_evidence: {
    label: 'Insufficient Evidence',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    barColor: 'bg-slate-500',
    icon: '❓',
  },
}

function getEffectiveCredibility(grievance, weatherData) {
  const baseCred = grievance?.reportCredibility || grievance?.report_credibility
  if (!baseCred) return null

  if (weatherData?.recentRainfall) {
    const rain24h = weatherData.recentRainfall.last24hMm ?? 0
    const rain6h = weatherData.recentRainfall.last6hMm ?? 0
    const rain1h = weatherData.recentRainfall.last1hMm ?? 0

    const hasWeatherReason = baseCred.reasons.some((r) => r.toLowerCase().includes('meteorological'))
    if (!hasWeatherReason) {
      let extraPoints = 0
      let weatherReason = ''
      if (rain24h >= 10 || rain6h >= 5 || rain1h >= 2) {
        extraPoints = 10
        weatherReason = `Meteorological support: Heavy recent precipitation recorded (${rain24h} mm in past 24h, ${rain1h} mm in last hour).`
      } else if (rain24h > 0 || rain6h > 0) {
        extraPoints = 5
        weatherReason = `Meteorological support: Moderate precipitation recorded (${rain24h} mm in past 24h).`
      } else {
        extraPoints = 0
        weatherReason = 'Meteorological context: Zero recent rainfall recorded; note that flooding can persist from prior accumulation, high tide, or structural drain/sewage blockage.'
      }

      const newScore = Math.max(0, Math.min(100, Math.round(baseCred.score + extraPoints)))
      let newLabel = 'insufficient_evidence'
      let newNextStep = 'Request more evidence: Contact citizen to confirm exact GPS coordinates and attach clear photographic evidence before dispatching field staff.'

      if (newScore >= 80) {
        newLabel = 'verified_evidence'
        newNextStep = 'Immediate field dispatch recommended: High-confidence evidence with local corroboration. Mobilize de-watering pumps or drainage clearance crew.'
      } else if (newScore >= 60) {
        newLabel = 'likely_credible'
        newNextStep = 'Queue for field team inspection: Credible report with good local context. Verify on-site water level and prioritize in current shift.'
      } else if (newScore >= 35) {
        newLabel = 'needs_verification'
        newNextStep = 'Verify with citizen or ward team: Request additional photos or landmark details before deploying heavy municipal equipment.'
      }

      return {
        score: newScore,
        label: newLabel,
        reasons: [...baseCred.reasons, weatherReason],
        recommendedNextStep: newNextStep,
      }
    }
  }

  return baseCred
}

/**
 * Report Credibility Assessment Component
 * Displays transparent 0-100 credibility assessment for flood-relevant complaints.
 */
function ReportCredibilityCard({ grievance, weatherState }) {
  const [isOpen, setIsOpen] = useState(true)

  if (!isFloodRelevantGrievance(grievance)) {
    return null
  }

  const credibility = getEffectiveCredibility(grievance, weatherState?.data)
  if (!credibility) {
    return null
  }

  const { score, label, reasons, recommendedNextStep } = credibility
  const config = CREDIBILITY_CONFIG[label] || CREDIBILITY_CONFIG.needs_verification

  return (
    <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs text-slate-900 shadow-xs mb-3">
      {/* Header with Collapsible Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 font-bold text-sm sm:text-base text-slate-900 hover:text-slate-700 transition cursor-pointer text-left"
        >
          <span>📊</span>
          <span>Report Credibility Assessment</span>
          <span className="text-xs text-slate-500 font-semibold ml-1">
            {isOpen ? '▲ Collapse' : '▼ Expand'}
          </span>
        </button>

        {/* Label & Score Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${config.badgeClass}`}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
            <span className="opacity-60">·</span>
            <span>{score}/100</span>
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3.5 pt-3.5 border-t border-slate-200 space-y-3.5">
          {/* Transparent Score Bar */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600 mb-1.5">
              <span>Evidence Confidence Meter</span>
              <span className="font-extrabold text-slate-900">{score}% Score</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-500 rounded-full ${config.barColor}`}
                style={{ width: `${Math.max(4, score)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
              <span>0 (Insufficient)</span>
              <span>35 (Verify)</span>
              <span>60 (Likely)</span>
              <span>80 (Verified)</span>
              <span>100</span>
            </div>
          </div>

          {/* Mandatory UI Disclaimer */}
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 font-medium flex items-center gap-2">
            <span className="text-base">ℹ️</span>
            <span>This is a decision-support assessment, not final field proof.</span>
          </div>

          {/* Reasons & Evidence Breakdown */}
          {Array.isArray(reasons) && reasons.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span>🔍</span> Contributing Factors & Evidence Log
              </h4>
              <ul className="space-y-1.5 text-xs">
                {reasons.map((reason, idx) => {
                  const isNegative =
                    reason.includes('No precise') ||
                    reason.includes('No photographic') ||
                    reason.includes('very brief') ||
                    reason.includes('Low AI')
                  const isNeutral = reason.includes('Zero recent rainfall') || reason.includes('Basic complaint')
                  return (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="mt-0.5 shrink-0 text-xs">
                        {isNegative ? (
                          <span className="text-rose-500 font-bold">⚠️</span>
                        ) : isNeutral ? (
                          <span className="text-slate-400 font-bold">ℹ️</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">✓</span>
                        )}
                      </span>
                      <span
                        className={
                          isNegative
                            ? 'text-rose-900 font-medium'
                            : isNeutral
                            ? 'text-slate-600'
                            : 'text-slate-800 font-medium'
                        }
                      >
                        {reason}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Recommended Next Step Callout */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 flex items-start gap-2.5 shadow-2xs">
            <span className="text-base shrink-0 mt-0.5">👉</span>
            <div>
              <span className="font-bold text-blue-900 block mb-0.5">Recommended Next Step:</span>
              <p className="font-medium text-blue-950 leading-relaxed">{recommendedNextStep}</p>
            </div>
          </div>

          {/* Reclassification / Override Context Note */}
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Admin can override status or reclassify at any time using the action buttons above.</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible Environmental Context Card
 * Displays Open-Meteo rainfall context for flood-relevant grievances.
 */
function EnvironmentalContextCard({ grievance, weatherState, onRetry }) {
  const [isOpen, setIsOpen] = useState(true)

  // Strictly enforce flood-relevance filter
  if (!isFloodRelevantGrievance(grievance)) {
    return null
  }

  const { data, loading, error, noLocation } = weatherState || {}
  const isDemo = data?.isDemoFallback || data?.source === 'Demo weather proxy'

  // Format freshness string
  let freshnessText = '—'
  if (data?.lastUpdated) {
    const timeStr = new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (typeof data.dataFreshnessMinutes === 'number') {
      freshnessText =
        data.dataFreshnessMinutes === 0
          ? `Updated just now (${timeStr})`
          : `Updated ${data.dataFreshnessMinutes} min ago (${timeStr})`
    } else {
      freshnessText = `Updated ${timeStr}`
    }
  }

  return (
    <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 sm:p-5 text-xs text-sky-950 shadow-xs mb-4">
      {/* Header with Collapsible Toggle */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 font-bold text-sm sm:text-base text-sky-950 hover:text-sky-800 transition cursor-pointer text-left"
        >
          <span>🌧</span>
          <span>Environmental Context</span>
          <span className="text-xs text-sky-600 font-semibold ml-1">
            {isOpen ? '▲ Collapse' : '▼ Expand'}
          </span>
        </button>

        {/* Source Badge (when data exists) */}
        {data && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              isDemo
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>{isDemo ? 'Demo weather proxy' : 'Open-Meteo'}</span>
          </span>
        )}
      </div>

      {/* Collapsible Content Body */}
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-sky-200/80 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 py-3 text-sky-800 font-semibold">
              <span className="animate-spin text-sm">⏳</span>
              <span>Fetching Open-Meteo rainfall context…</span>
            </div>
          )}

          {noLocation && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold flex items-center gap-2">
              <span>📍</span>
              <span>No precise location is available; weather context cannot be calculated.</span>
            </div>
          )}

          {error && !loading && !noLocation && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>Weather context is temporarily unavailable.</span>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {data && !loading && !error && !noLocation && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Recent Observed Rainfall */}
                <div className="bg-white/95 border border-sky-100 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sky-950 flex items-center gap-1.5 text-xs">
                      <span>⏱️</span> Recent Rainfall (Observed)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-700">
                    <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100/60">
                      <span className="text-[11px] text-gray-500 block font-medium">Last 1 hour</span>
                      <strong className="text-sm text-gray-900 font-extrabold">{data.recentRainfall?.last1hMm ?? 0} mm</strong>
                    </div>
                    <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100/60">
                      <span className="text-[11px] text-gray-500 block font-medium">Last 3 hours</span>
                      <strong className="text-sm text-gray-900 font-extrabold">{data.recentRainfall?.last3hMm ?? 0} mm</strong>
                    </div>
                    <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100/60">
                      <span className="text-[11px] text-gray-500 block font-medium">Last 6 hours</span>
                      <strong className="text-sm text-gray-900 font-extrabold">{data.recentRainfall?.last6hMm ?? 0} mm</strong>
                    </div>
                    <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100/60">
                      <span className="text-[11px] text-gray-500 block font-medium">Last 24 hours</span>
                      <strong className="text-sm text-gray-900 font-extrabold">{data.recentRainfall?.last24hMm ?? 0} mm</strong>
                    </div>
                  </div>
                </div>

                {/* Forecast Rainfall */}
                <div className="bg-white/95 border border-sky-100 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sky-950 flex items-center gap-1.5 text-xs">
                      <span>🔮</span> Forecast Rainfall (Projected)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-700">
                    <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100/60">
                      <span className="text-[11px] text-gray-500 block font-medium">Next 3 hours</span>
                      <strong className="text-sm text-gray-900 font-extrabold">{data.forecastRainfall?.next3hMm ?? 0} mm</strong>
                    </div>
                    <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100/60">
                      <span className="text-[11px] text-gray-500 block font-medium">Next 6 hours</span>
                      <strong className="text-sm text-gray-900 font-extrabold">{data.forecastRainfall?.next6hMm ?? 0} mm</strong>
                    </div>
                  </div>
                  <div className="mt-2.5 text-[11px] text-sky-800 font-medium flex items-center gap-1">
                    <span>🕒</span>
                    <span>{freshnessText}</span>
                  </div>
                </div>
              </div>

              {/* Disclaimer Text */}
              <p className="text-[11px] text-sky-800 italic bg-sky-100/70 p-2.5 rounded-lg border border-sky-200/70 font-medium leading-relaxed">
                ℹ️ Weather context supports assessment but does not by itself confirm or reject a citizen report.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
