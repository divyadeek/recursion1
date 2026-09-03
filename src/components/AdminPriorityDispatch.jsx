import React, { useState, useEffect, useMemo } from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Truck,
  UserCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  Droplets,
  Layers,
  FileText,
  ChevronRight,
  ExternalLink,
  Info,
  Send,
  MessageSquare,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react'
import { getFloodOpsRiskAssessment, updateFloodOpsOperationAction } from '../services/api'

export default function AdminPriorityDispatch({ onNavigateToFloodOpsMap, onSelectGrievance }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cells, setCells] = useState([])
  const [summary, setSummary] = useState(null)
  const [lastUpdated, setLastUpdated] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortBy, setSortBy] = useState('priority_rank') // 'priority_rank' | 'risk_desc' | 'confidence_desc'

  // Selected cell for action modal or detail view
  const [activeActionCell, setActiveActionCell] = useState(null)
  const [actionTargetStatus, setActionTargetStatus] = useState('dispatched')
  const [actionNotes, setActionNotes] = useState('')
  const [actionTeam, setActionTeam] = useState('Zone 9 Quick-Response Drainage Squad')
  const [notifyCitizens, setNotifyCitizens] = useState(true)
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')

  // Detail drawer for full evidence & history
  const [detailCell, setDetailCell] = useState(null)

  const fetchOperationsData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getFloodOpsRiskAssessment()
      setCells(res.data.cells || [])
      setSummary(res.data.summary || null)
      setLastUpdated(res.data.lastUpdated || new Date().toISOString())
    } catch (err) {
      console.error('Failed to load priority dispatch operations:', err)
      setError(err.response?.data?.detail || 'Failed to fetch priority dispatch assessments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOperationsData()
  }, [])

  // Action submission handler
  const handleExecuteAction = async (e) => {
    e.preventDefault()
    if (!activeActionCell) return
    setSubmittingAction(true)
    setActionSuccessMsg('')
    try {
      const res = await updateFloodOpsOperationAction(activeActionCell.cellId, {
        status: actionTargetStatus,
        notes: actionNotes,
        team: actionTeam,
        notify_citizens: notifyCitizens,
      })

      // Update local state immediately
      setCells((prev) =>
        prev.map((c) => {
          if (c.cellId === activeActionCell.cellId) {
            return {
              ...c,
              operationStatus: actionTargetStatus,
              operationRecord: res.data.operation,
            }
          }
          return c
        })
      )

      if (detailCell && detailCell.cellId === activeActionCell.cellId) {
        setDetailCell((prev) => ({
          ...prev,
          operationStatus: actionTargetStatus,
          operationRecord: res.data.operation,
        }))
      }

      setActionSuccessMsg(
        `Action updated: ${actionTargetStatus.replace('_', ' ').toUpperCase()} for ${activeActionCell.areaName}. Linked citizen complaints notified.`
      )
      setTimeout(() => {
        setActiveActionCell(null)
        setActionSuccessMsg('')
      }, 1500)
    } catch (err) {
      console.error('Action failed:', err)
      alert(err.response?.data?.detail || 'Failed to apply operation action.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const openActionModal = (cell, defaultStatus) => {
    setActiveActionCell(cell)
    setActionTargetStatus(defaultStatus || (cell.riskLevel === 'high' || cell.riskLevel === 'critical' ? 'dispatched' : 'verification_requested'))
    setActionNotes(
      defaultStatus === 'dispatched'
        ? `Deploying emergency suction gully sucker and clearing roadside culverts along ${cell.areaName}.`
        : defaultStatus === 'verification_requested'
        ? `Requesting immediate field patrol check on standing water depth at ${cell.areaName}.`
        : ''
    )
    if (cell.areaName.includes('Velachery') || cell.areaName.includes('Madipakkam')) {
      setActionTeam('South Chennai Zone 14 Drainage Division')
    } else if (cell.areaName.includes('T. Nagar')) {
      setActionTeam('Central Zone 10 Stormwater Drain Taskforce')
    } else {
      setActionTeam('Ward Quick-Response Field Patrol Unit')
    }
  }

  // Filter and sort items
  const filteredAndRankedCells = useMemo(() => {
    let result = [...cells]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.areaName.toLowerCase().includes(q) ||
          c.cellId.toLowerCase().includes(q) ||
          c.recommendedAction.toLowerCase().includes(q) ||
          c.evidenceSummary.toLowerCase().includes(q)
      )
    }

    if (selectedRiskLevel !== 'all') {
      result = result.filter((c) => c.riskLevel === selectedRiskLevel)
    }

    if (selectedStatus !== 'all') {
      result = result.filter((c) => (c.operationStatus || 'pending') === selectedStatus)
    }

    if (sortBy === 'risk_desc') {
      result.sort((a, b) => b.waterloggingRisk - a.waterloggingRisk)
    } else if (sortBy === 'confidence_desc') {
      result.sort((a, b) => b.confidence - a.confidence)
    } else {
      // Default: preserve priority_rank (1. risk, 2. confidence, 3. urgency, 4. duplicates, 5. freshness)
      result.sort((a, b) => (a.rank || 999) - (b.rank || 999))
    }

    return result
  }, [cells, searchQuery, selectedRiskLevel, selectedStatus, sortBy])

  // Formatting helpers
  const getRiskBadge = (level) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300 font-semibold'
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 font-medium'
      case 'low':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium'
    }
  }

  const getConfidenceBadge = (label) => {
    switch (label) {
      case 'high':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'medium':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      case 'low':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'dispatched':
        return 'bg-purple-100 text-purple-800 border-purple-300 font-medium'
      case 'verification_requested':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-medium'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
      case 'resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium'
      case 'false_alarm':
        return 'bg-gray-100 text-gray-700 border-gray-300 font-medium'
      case 'pending':
      default:
        return 'bg-orange-50 text-orange-700 border-orange-200 font-medium'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'dispatched':
        return 'Dispatched'
      case 'verification_requested':
        return 'Verification Req.'
      case 'in_progress':
        return 'In Progress'
      case 'resolved':
        return 'Resolved'
      case 'false_alarm':
        return 'False Alarm'
      case 'pending':
      default:
        return 'Pending Dispatch'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Meta Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                FloodOps Operations
              </span>
              <span className="text-xs text-gray-500">
                Prediction Horizon: <strong>Next 3 Hours</strong>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Priority Dispatch Operations</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">
              Ranked municipal dispatch matrix combining real-time rainfall, verified citizen grievances, duplicate
              clustering, and historical watershed vulnerability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateToFloodOpsMap && onNavigateToFloodOpsMap()}
              className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
              title="Open the 500m interactive grid risk map"
            >
              <Layers className="w-4 h-4 mr-1.5" />
              View on FloodOps Map
            </button>
            <button
              onClick={fetchOperationsData}
              disabled={loading}
              className="inline-flex items-center px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              Refresh Assessment
            </button>
          </div>
        </div>

        {/* Explainability notice mandated by design */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-700">
          <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Automated Ranking Logic:</strong> Sectors are ranked in strict hierarchy: (1) High Inferred Waterlogging
            Risk, (2) Evidence Confidence, (3) Citizen Urgency, (4) Duplicate Cluster Density, (5) Telemetry Freshness.{' '}
            <span className="text-slate-500">
              This is an inferred environmental-risk estimate, not a direct sensor measurement.
            </span>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Monitored Sectors</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{cells.length}</div>
          <div className="text-xs text-gray-500 mt-1">500m × 500m grid cells</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-red-200 bg-red-50/20 shadow-sm">
          <div className="text-xs font-medium text-red-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> High & Critical Risk
          </div>
          <div className="text-2xl font-bold text-red-700 mt-1">
            {cells.filter((c) => c.riskLevel === 'critical' || c.riskLevel === 'high').length}
          </div>
          <div className="text-xs text-red-600 mt-1">Require frontline action</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
          <div className="text-xs font-medium text-purple-700 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-purple-600" /> Drainage Dispatched
          </div>
          <div className="text-2xl font-bold text-purple-800 mt-1">
            {cells.filter((c) => c.operationStatus === 'dispatched' || c.operationStatus === 'in_progress').length}
          </div>
          <div className="text-xs text-purple-600 mt-1">Teams active in field</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <div className="text-xs font-medium text-amber-700 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-amber-600" /> Verification Patrol
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-1">
            {cells.filter((c) => c.operationStatus === 'verification_requested').length}
          </div>
          <div className="text-xs text-amber-600 mt-1">Ground check requested</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <div className="text-xs font-medium text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Resolved Sectors
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">
            {cells.filter((c) => c.operationStatus === 'resolved').length}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Water cleared / mitigated</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm">
          <div className="text-xs font-medium text-blue-700 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-blue-600" /> Linked Complaints
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{summary?.totalLinkedComplaints || 0}</div>
          <div className="text-xs text-blue-600 mt-1">Citizen reports synchronized</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search area (e.g., Velachery, T. Nagar), action, or cell ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Risk:</span>
            </div>
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className="text-xs font-medium py-1.5 px-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical (75–100)</option>
              <option value="high">High (50–74)</option>
              <option value="medium">Medium (25–49)</option>
              <option value="low">Low (0–24)</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
              <span>Status:</span>
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-medium py-1.5 px-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Operation Statuses</option>
              <option value="pending">Pending</option>
              <option value="verification_requested">Verification Requested</option>
              <option value="dispatched">Dispatched</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="false_alarm">False Alarm</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
              <span>Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-medium py-1.5 px-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="priority_rank">Priority Ranking (Recommended)</option>
              <option value="risk_desc">Waterlogging Risk (High to Low)</option>
              <option value="confidence_desc">Confidence Score (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Operations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading && (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Loading priority dispatch matrix...</p>
            <p className="text-xs text-gray-500">Evaluating multi-source evidence and hydrological data</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-8 text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="font-semibold text-sm">{error}</p>
            <button
              onClick={fetchOperationsData}
              className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filteredAndRankedCells.length === 0 && (
          <div className="py-16 text-center text-gray-500">
            <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">No operations match your current filters.</p>
            <p className="text-xs text-gray-500 mt-1">Try resetting the risk level or operation status filters.</p>
          </div>
        )}

        {!loading && !error && filteredAndRankedCells.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 tracking-wider uppercase">
                  <th className="py-3 px-3 w-14 text-center">Rank</th>
                  <th className="py-3 px-4">Area / Sector Cell</th>
                  <th className="py-3 px-3">Risk</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3">Rainfall Summary</th>
                  <th className="py-3 px-3 text-center">Credible Reports</th>
                  <th className="py-3 px-3 text-center">Duplicates</th>
                  <th className="py-3 px-4 min-w-[220px]">Recommended Action & ETA</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAndRankedCells.map((cell) => {
                  const status = cell.operationStatus || 'pending'
                  const isHighPriority = cell.riskLevel === 'critical' || cell.riskLevel === 'high'

                  return (
                    <tr
                      key={cell.cellId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        cell.rank === 1 && status === 'pending' ? 'bg-red-50/30' : ''
                      }`}
                    >
                      {/* Rank Column */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${
                            cell.rank === 1
                              ? 'bg-red-600 text-white border-red-700 shadow-sm'
                              : cell.rank === 2
                              ? 'bg-amber-500 text-white border-amber-600'
                              : cell.rank === 3
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          #{cell.rank}
                        </span>
                      </td>

                      {/* Area/Cell Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span>{cell.areaName}</span>
                          {isHighPriority && (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="High Priority Sector" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{cell.cellId}</span>
                          <span className="text-gray-300">•</span>
                          <span>
                            {cell.coordinates.latitude.toFixed(3)}, {cell.coordinates.longitude.toFixed(3)}
                          </span>
                        </div>
                      </td>

                      {/* Waterlogging Risk Score & Level */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-10 text-right font-bold text-base text-gray-900">
                            {cell.waterloggingRisk}
                            <span className="text-xs text-gray-400 font-normal">/100</span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs border uppercase tracking-wider ${getRiskBadge(
                              cell.riskLevel
                            )}`}
                          >
                            {cell.riskLevel}
                          </span>
                        </div>
                        {/* Visual mini bar */}
                        <div className="w-24 bg-gray-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              cell.riskLevel === 'critical'
                                ? 'bg-red-600'
                                : cell.riskLevel === 'high'
                                ? 'bg-amber-500'
                                : cell.riskLevel === 'medium'
                                ? 'bg-yellow-400'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${cell.waterloggingRisk}%` }}
                          />
                        </div>
                      </td>

                      {/* Confidence Score & Label */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800 text-sm">{cell.confidence}%</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs border uppercase font-medium ${getConfidenceBadge(
                              cell.confidenceLabel
                            )}`}
                          >
                            {cell.confidenceLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {cell.confidenceBreakdown?.independentReporters?.reporterCount || 0} unique reporters
                        </div>
                      </td>

                      {/* Rainfall Summary */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-800">
                          <Droplets className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span>{cell.rainfallSummary || 'Telemetry available'}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {cell.riskBreakdown?.recentRainfall?.details?.split(',')[0] || 'Rainfall tracked'}
                        </div>
                      </td>

                      {/* Number of Linked Credible Reports */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            cell.credibleReportsCount > 0
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {cell.credibleReportsCount} {cell.credibleReportsCount === 1 ? 'report' : 'reports'}
                        </span>
                        {cell.maxUrgency > 0 && (
                          <div className="text-[10px] text-gray-500 mt-0.5">Max Urg: {cell.maxUrgency}/5</div>
                        )}
                      </td>

                      {/* Duplicate Count */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            cell.duplicateCount > 0
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'text-gray-400'
                          }`}
                        >
                          {cell.duplicateCount}
                        </span>
                      </td>

                      {/* Recommended Action & Response Time */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-gray-900 leading-snug">{cell.recommendedAction}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                            <Clock className="w-3 h-3 mr-1 text-red-600" />
                            ETA: {cell.suggestedResponseTime}
                          </span>
                          <span className="text-[11px] text-gray-500 truncate max-w-[160px]" title={cell.evidenceSummary}>
                            {cell.evidenceSummary}
                          </span>
                        </div>
                      </td>

                      {/* Operation Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border uppercase tracking-wider ${getStatusBadge(
                            status
                          )}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                        {cell.operationRecord?.teamDispatched && (
                          <div className="text-[10px] text-purple-700 font-medium truncate max-w-[120px] mt-0.5">
                            {cell.operationRecord.teamDispatched}
                          </div>
                        )}
                      </td>

                      {/* Action Triggers */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Action Dispatch Button */}
                          {status === 'pending' && (
                            <>
                              {isHighPriority ? (
                                <button
                                  onClick={() => openActionModal(cell, 'dispatched')}
                                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors"
                                  title="Dispatch Drainage Response Team"
                                >
                                  <Truck className="w-3.5 h-3.5 mr-1" />
                                  Dispatch
                                </button>
                              ) : (
                                <button
                                  onClick={() => openActionModal(cell, 'verification_requested')}
                                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors"
                                  title="Request Field Patrol Verification"
                                >
                                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                                  Verify
                                </button>
                              )}
                            </>
                          )}

                          {status === 'verification_requested' && (
                            <button
                              onClick={() => openActionModal(cell, 'dispatched')}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                              title="Field confirmed, dispatch drainage"
                            >
                              <Truck className="w-3.5 h-3.5 mr-1" />
                              Dispatch
                            </button>
                          )}

                          {status === 'dispatched' && (
                            <button
                              onClick={() => openActionModal(cell, 'in_progress')}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Mark team arrived and in progress"
                            >
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              In Progress
                            </button>
                          )}

                          {(status === 'dispatched' || status === 'in_progress') && (
                            <button
                              onClick={() => openActionModal(cell, 'resolved')}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Mark water cleared and resolved"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Resolve
                            </button>
                          )}

                          {status === 'verification_requested' && (
                            <button
                              onClick={() => openActionModal(cell, 'false_alarm')}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Field check showed normal runoff"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              False Alarm
                            </button>
                          )}

                          {/* Full Options / Drawer Button */}
                          <button
                            onClick={() => setDetailCell(cell)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View multi-source evidence details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Execution Modal */}
      {activeActionCell && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  Sector Action Dispatch
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-1">
                  {activeActionCell.areaName} ({activeActionCell.cellId})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Risk Score: <strong>{activeActionCell.waterloggingRisk}/100</strong> ({activeActionCell.riskLevel}) •{' '}
                  Confidence: <strong>{activeActionCell.confidenceLabel}</strong>
                </p>
              </div>
              <button
                onClick={() => setActiveActionCell(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {actionSuccessMsg ? (
              <div className="py-8 text-center text-emerald-700">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2 animate-bounce" />
                <p className="font-bold text-base">{actionSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleExecuteAction} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Action & State</label>
                  <select
                    value={actionTargetStatus}
                    onChange={(e) => setActionTargetStatus(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="dispatched">Dispatch Drainage Team (Heavy Pumps & Gully Sucker)</option>
                    <option value="verification_requested">Request Field Verification Patrol (Ground Check)</option>
                    <option value="in_progress">Mark In Progress (On-site Mitigation)</option>
                    <option value="resolved">Resolve (Surface Inundation Cleared)</option>
                    <option value="false_alarm">Mark False Alarm (Non-hazardous absorption)</option>
                  </select>
                </div>

                {(actionTargetStatus === 'dispatched' || actionTargetStatus === 'verification_requested') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Frontline Unit</label>
                    <input
                      type="text"
                      value={actionTeam}
                      onChange={(e) => setActionTeam(e.target.value)}
                      placeholder="e.g. Zone 10 Stormwater Drainage Squad 2"
                      className="w-full text-sm py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Operational Dispatch Notes</label>
                  <textarea
                    rows={3}
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Instructions for team, pumps deployed, culvert coordinates..."
                    className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {activeActionCell.credibleReportsCount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <label className="flex items-start gap-2 text-xs text-blue-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyCitizens}
                        onChange={(e) => setNotifyCitizens(e.target.checked)}
                        className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <strong>Notify {activeActionCell.credibleReportsCount} Linked Citizen Reporters</strong>
                        <div className="text-blue-700 text-[11px] mt-0.5">
                          Sends automated SMS updates and logs timeline progression for all verified grievances in this
                          sector.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setActiveActionCell(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 mr-1.5" />
                    {submittingAction ? 'Dispatching...' : 'Confirm & Execute'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Detail & Evidence Drawer */}
      {detailCell && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-gray-200 pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Rank #{detailCell.rank}
                    </span>
                    <span
                      className={`text-xs uppercase font-semibold px-2 py-0.5 rounded border ${getRiskBadge(
                        detailCell.riskLevel
                      )}`}
                    >
                      {detailCell.riskLevel} Risk
                    </span>
                    <span
                      className={`text-xs uppercase font-semibold px-2 py-0.5 rounded border ${getConfidenceBadge(
                        detailCell.confidenceLabel
                      )}`}
                    >
                      {detailCell.confidenceLabel} Conf.
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{detailCell.areaName}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">Cell: {detailCell.cellId}</p>
                </div>
                <button
                  onClick={() => setDetailCell(null)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Action Banner */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Recommended Protocol
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{detailCell.recommendedAction}</div>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-red-700 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Suggested ETA: {detailCell.suggestedResponseTime}
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-purple-700 font-medium">Status: {getStatusLabel(detailCell.operationStatus)}</span>
                </div>
              </div>

              {/* 6-Factor Weighted Risk Breakdown */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-gray-500" />
                  Hydrological Risk Factor Contributions (Sum: {detailCell.waterloggingRisk}/100)
                </h4>
                <div className="space-y-2.5 text-xs">
                  {/* Factor 1 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>30% Recent Rainfall</span>
                      <span>+{detailCell.riskBreakdown?.recentRainfall?.weightedContribution || 0} pts</span>
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {detailCell.riskBreakdown?.recentRainfall?.details}
                    </div>
                  </div>
                  {/* Factor 2 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>25% Credible Citizen Reports</span>
                      <span>+{detailCell.riskBreakdown?.credibleReports?.weightedContribution || 0} pts</span>
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {detailCell.riskBreakdown?.credibleReports?.details} (Credibility:{' '}
                      {detailCell.riskBreakdown?.credibleReports?.meanCredibility || 0}%)
                    </div>
                  </div>
                  {/* Factor 3 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>15% Duplicate Cluster Size</span>
                      <span>+{detailCell.riskBreakdown?.duplicateCluster?.weightedContribution || 0} pts</span>
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {detailCell.riskBreakdown?.duplicateCluster?.details}
                    </div>
                  </div>
                  {/* Factor 4 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>15% Historical Hotspot Score</span>
                      <span>+{detailCell.riskBreakdown?.historicalHotspot?.weightedContribution || 0} pts</span>
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {detailCell.riskBreakdown?.historicalHotspot?.details}
                    </div>
                  </div>
                  {/* Factor 5 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>10% Drainage Vulnerability</span>
                      <span>+{detailCell.riskBreakdown?.drainageVulnerability?.weightedContribution || 0} pts</span>
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {detailCell.riskBreakdown?.drainageVulnerability?.details}
                    </div>
                  </div>
                  {/* Factor 6 */}
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>5% Forecast Rainfall (Next 3h/6h)</span>
                      <span>+{detailCell.riskBreakdown?.forecastRainfall?.weightedContribution || 0} pts</span>
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                      {detailCell.riskBreakdown?.forecastRainfall?.details}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Provenance Log */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Evidence Provenance</h4>
                <div className="space-y-1.5 text-[11px] text-gray-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {detailCell.provenance?.map((p, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-gray-800">{p.metric}</span>: {p.details}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">{p.source}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked Grievances */}
              {detailCell.linkedComplaintIds && detailCell.linkedComplaintIds.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Linked Citizen Grievances ({detailCell.linkedComplaintIds.length})
                  </h4>
                  <div className="space-y-2">
                    {detailCell.linkedComplaintIds.map((gid) => (
                      <div
                        key={gid}
                        className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs hover:border-blue-300 transition-colors"
                      >
                        <div className="font-mono text-gray-700 truncate max-w-[240px]">ID: {gid}</div>
                        <button
                          onClick={() => {
                            if (onSelectGrievance) onSelectGrievance(gid)
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 text-[11px]"
                        >
                          Inspect <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Actions */}
            <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setDetailCell(null)
                  if (onNavigateToFloodOpsMap) onNavigateToFloodOpsMap(detailCell)
                }}
                className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 mr-1" />
                Inspect on Grid Map
              </button>

              <button
                onClick={() => {
                  const target = detailCell
                  setDetailCell(null)
                  openActionModal(target)
                }}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Change Dispatch State
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
