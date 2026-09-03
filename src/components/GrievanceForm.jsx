import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  submitGrievance,
  listMyGrievances,
  analyzeGrievanceImage,
  reverseGeocode,
  getGrievance,
  getMyNotifications,
} from '../services/api.js'
import { isValidComplaintText, VALID_COMPLAINT_EXAMPLE } from '../utils/validators.js'
import LocationPicker from './LocationPicker.jsx'

const STATUS_CONFIG = {
  unsolved: {
    label: 'UNSOLVED',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
    bgLight: 'bg-amber-50/70 border-amber-200',
  },
  in_progress: {
    label: 'IN PROGRESS',
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    dot: 'bg-blue-600 animate-pulse',
    bgLight: 'bg-blue-50/70 border-blue-200',
  },
  solved: {
    label: 'SOLVED',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-600',
    bgLight: 'bg-emerald-50/70 border-emerald-200',
  },
  rejected: {
    label: 'REJECTED',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    dot: 'bg-rose-600',
    bgLight: 'bg-rose-50/70 border-rose-200',
  },
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
  out_of_scope: '🚫',
  unclear: '🔍',
}

const CATEGORY_NAMES = {
  water_supply: 'Water Supply',
  electricity: 'Electricity Board',
  roads: 'Public Works (Roads)',
  sanitation: 'Sanitation & Sewage',
  public_safety: 'Public Safety / Hazards',
  street_lights: 'Street Lighting',
  garbage_waste: 'Solid Waste Management',
  waterlogging: 'Waterlogging / Flooding',
  blocked_drain: 'Blocked Drain / Sewage Overflow',
  out_of_scope: 'Out of Scope',
  unclear: 'Manual Review Required',
}

export default function GrievanceForm({ showToast }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: null,
    longitude: null,
    address: '',
    shortName: '',
    locationString: '',
    rawInput: '',
  })
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [analyzingImage, setAnalyzingImage] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [grievances, setGrievances] = useState([])
  const [notifications, setNotifications] = useState([])
  const [selectedGrievance, setSelectedGrievance] = useState(null)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [activeTab, setActiveTab] = useState('submit') // 'submit' | 'history' | 'notifications'
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [incomingSmsBanner, setIncomingSmsBanner] = useState(null)
  const [previewPhotoModal, setPreviewPhotoModal] = useState(null)
  const [filterNotifCategory, setFilterNotifCategory] = useState('all')

  const initialLoadDone = useRef(false)
  const previousNotifIdsRef = useRef(new Set())
  const photoAbortControllerRef = useRef(null)

  const loadData = useCallback(async (isPolling = false) => {
    try {
      const [gRes, nRes] = await Promise.all([listMyGrievances(), getMyNotifications()])
      const newGrievances = gRes.data || []
      const newNotifications = nRes.data || []

      setGrievances(newGrievances)
      setNotifications(newNotifications)

      // On background polling, check for newly arrived SMS notifications
      if (initialLoadDone.current && isPolling) {
        const newlyArrived = newNotifications.filter((n) => !previousNotifIdsRef.current.has(n.id))
        if (newlyArrived.length > 0) {
          const latest = newlyArrived[0]
          setUnreadNotifCount((prev) => prev + newlyArrived.length)
          setIncomingSmsBanner(latest)
          showToast?.(`📱 New SMS Alert: ${latest.message.substring(0, 80)}…`, 'info')
        }
      }

      // Update seen notification IDs
      previousNotifIdsRef.current = new Set(newNotifications.map((n) => n.id))
      initialLoadDone.current = true
    } catch {
      // quiet fail on background polling
    }
  }, [showToast])

  // Initial load
  useEffect(() => {
    loadData(false)
  }, [loadData])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (photoAbortControllerRef.current) {
        photoAbortControllerRef.current.abort()
      }
    }
  }, [])

  // Real-time automatic polling every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true)
    }, 3500)
    return () => clearInterval(interval)
  }, [loadData])

  // AI-Based Photo Upload & Automatic Grievance Draft Generation
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Cancel any previous in-flight photo analysis
    if (photoAbortControllerRef.current) {
      photoAbortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    photoAbortControllerRef.current = abortController

    setImage(file)
    setImagePreview(URL.createObjectURL(file))
    setAiAnalysis(null)
    setError('')

    const formData = new FormData()
    formData.append('image', file)
    if (text.trim()) {
      formData.append('text', text.trim())
    }

    setAnalyzingImage(true)
    try {
      const res = await analyzeGrievanceImage(formData, { signal: abortController.signal })
      if (res.data) {
        const data = res.data
        setAiAnalysis(data)

        if (data.category === 'out_of_scope' || !data.is_valid_civic_issue) {
          showToast?.('⚠️ Non-civic or out-of-scope photo detected. Please review guidance.', 'error')
        } else if (data.category === 'unclear' || data.needs_manual_review) {
          showToast?.('ℹ️ Photo analyzed. Please check and complete the details.', 'info')
        } else {
          showToast?.(`✨ Identified: ${data.short_title || CATEGORY_NAMES[data.category] || data.category}`)
        }

        const suggested = data.suggested_description || data.generated_complaint_text
        if (suggested && (!text || text.trim().length < 20)) {
          setText(suggested)
        }
        if (data.category && data.category !== 'out_of_scope' && data.category !== 'unclear') {
          setCategory(data.category)
        }
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        showToast?.('Photo uploaded. Add description details manually if needed.', 'info')
      }
    } finally {
      setAnalyzingImage(false)
    }
  }

  const handleRemovePhoto = () => {
    if (photoAbortControllerRef.current) {
      photoAbortControllerRef.current.abort()
    }
    setImage(null)
    setImagePreview(null)
    setAiAnalysis(null)
    setAnalyzingImage(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isValidComplaintText(text)) {
      setError('Complaint text must be between 20 and 2000 characters.')
      return
    }

    const finalLocation = selectedLocation.address || selectedLocation.shortName || selectedLocation.locationString || 'Chennai'

    const formData = new FormData()
    formData.append('text', text)
    formData.append('location', finalLocation)
    if (category) formData.append('category', category)
    if (selectedLocation.latitude != null) formData.append('latitude', String(selectedLocation.latitude))
    if (selectedLocation.longitude != null) formData.append('longitude', String(selectedLocation.longitude))
    if (selectedLocation.address) formData.append('address', selectedLocation.address)
    if (image) formData.append('image', image)

    setLoading(true)
    try {
      const res = await submitGrievance(formData)
      showToast?.(`Complaint submitted! Classified as ${res.data.category} (Urgency: ${res.data.urgency_score}/10)`)
      setText('')
      setCategory('')
      setSelectedLocation({
        latitude: null,
        longitude: null,
        address: '',
        shortName: '',
        locationString: '',
        rawInput: '',
      })
      setImage(null)
      setImagePreview(null)
      setRejectedCount(0)
      loadData(false)
      setActiveTab('history')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Submission failed. Please check inputs.'
      setError(detail)
      if (err.response?.status === 422) {
        setRejectedCount((c) => c + 1)
      }
    } finally {
      setLoading(false)
    }
  }

  const viewGrievanceDetails = async (id) => {
    if (!id) return
    try {
      const res = await getGrievance(id)
      setSelectedGrievance(res.data)
    } catch {
      showToast?.('Could not load grievance details', 'error')
    }
  }

  const handleOpenNotificationsTab = () => {
    setActiveTab('notifications')
    setUnreadNotifCount(0)
    setIncomingSmsBanner(null)
  }

  const filteredNotifications = filterNotifCategory === 'all'
    ? notifications
    : notifications.filter((n) => n.category === filterNotifCategory)

  return (
    <div className="space-y-6">
      {/* Live Incoming SMS Popup Banner */}
      {incomingSmsBanner && (
        <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-xl border-2 border-blue-300 animate-bounce transition-all flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📱</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/25 px-2.5 py-0.5 rounded-full">
                  Instant SMS Received
                </span>
                <span className="text-xs text-blue-100">
                  {new Date(incomingSmsBanner.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <p className="text-sm font-semibold mt-1">{incomingSmsBanner.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleOpenNotificationsTab()
                if (incomingSmsBanner.grievance_id) {
                  viewGrievanceDetails(incomingSmsBanner.grievance_id)
                }
              }}
              className="bg-white text-blue-800 text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm hover:bg-blue-50 transition cursor-pointer"
            >
              View Update
            </button>
            <button
              onClick={() => setIncomingSmsBanner(null)}
              className="text-white/80 hover:text-white text-base font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Navigation tabs for Citizen: Write | Complaints | SMS */}
      <div className="flex border-b border-gray-200 bg-white rounded-2xl shadow-xs px-5 pt-3 gap-3 sm:gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('submit')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'submit'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-2xl">✍️</span>
          <span>Write</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'history'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-2xl">📋</span>
          <span>Complaints</span>
          <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
            {grievances.length}
          </span>
        </button>

        <button
          onClick={handleOpenNotificationsTab}
          className={`pb-3.5 text-base font-semibold border-b-2 transition flex items-center gap-2.5 whitespace-nowrap relative cursor-pointer ${
            activeTab === 'notifications'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-2xl">🔔</span>
          <span>SMS</span>
          <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
            {notifications.length}
          </span>
          {unreadNotifCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white animate-pulse">
              +{unreadNotifCount} New
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: WRITE */}
      {activeTab === 'submit' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-7">
            <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
              <span className="text-2xl">✍️</span>
              <span>Write Grievance</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                  <span className="text-xl">📸</span>
                  <span>Upload Grievance Photo</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-5 text-center hover:border-brand-500 hover:bg-brand-50/20 transition bg-gray-50/60">
                  <input
                    type="file"
                    id="complaint-photo-input"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="complaint-photo-input"
                    className="cursor-pointer inline-flex flex-col items-center justify-center"
                  >
                    <span className="text-4xl mb-1.5">📷</span>
                    <span className="text-sm font-semibold text-brand-600 hover:underline">
                      Click to snap or upload a photo
                    </span>
                    <span className="text-xs text-gray-500 mt-1">JPG, PNG or WEBP (road damage, water leak, garbage, etc.)</span>
                  </label>

                  {analyzingImage && (
                    <div className="mt-3.5 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs font-medium text-blue-800 flex items-center justify-center gap-2.5">
                      <span className="animate-spin text-lg">⚙️</span>
                      <span>Analyzing photo and preparing draft text…</span>
                    </div>
                  )}

                  {imagePreview && (
                    <div className="mt-4 space-y-3 bg-white p-4 rounded-xl border border-gray-200 text-left">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <img
                          src={imagePreview}
                          alt="Uploaded preview"
                          className="h-32 w-44 object-cover rounded-xl border border-gray-200 shadow-sm shrink-0"
                        />
                        <div className="space-y-2 flex-1">
                          {aiAnalysis ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                                    aiAnalysis.category === 'out_of_scope'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : aiAnalysis.category === 'unclear'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  }`}
                                >
                                  <span className="text-base">
                                    {CATEGORY_ICONS[aiAnalysis.category] || CATEGORY_ICONS[aiAnalysis.suggested_category] || '🔍'}
                                  </span>
                                  <span>
                                    {CATEGORY_NAMES[aiAnalysis.category] ||
                                      CATEGORY_NAMES[aiAnalysis.suggested_category] ||
                                      aiAnalysis.category?.replace('_', ' ')}
                                  </span>
                                </span>

                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  Urgency: {aiAnalysis.urgency_score}/10
                                </span>

                                {typeof aiAnalysis.confidence === 'number' && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                                    {Math.round(aiAnalysis.confidence * 100)}% AI Confidence
                                  </span>
                                )}
                              </div>

                              <p className="text-sm font-bold text-gray-900">
                                {aiAnalysis.short_title || aiAnalysis.detected_issue_summary}
                              </p>

                              {aiAnalysis.visible_evidence?.length > 0 && (
                                <div className="text-xs text-gray-600 space-y-0.5">
                                  <span className="font-semibold text-gray-700">Observed Evidence:</span>
                                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-gray-600">
                                    {aiAnalysis.visible_evidence.map((ev, i) => (
                                      <li key={i}>{ev}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {aiAnalysis.category === 'out_of_scope' ? (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                                  <p className="font-bold flex items-center gap-1">
                                    <span>🚫</span> Out of Municipal Scope
                                  </p>
                                  <p>{aiAnalysis.user_guidance || aiAnalysis.rejection_reason}</p>
                                </div>
                              ) : aiAnalysis.user_guidance ? (
                                <div className="p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                                  <span className="text-sm">ℹ️</span>
                                  <p className="flex-1 font-medium">{aiAnalysis.user_guidance}</p>
                                </div>
                              ) : null}

                              {aiAnalysis.suggested_description && text !== aiAnalysis.suggested_description && (
                                <button
                                  type="button"
                                  onClick={() => setText(aiAnalysis.suggested_description)}
                                  className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold px-3 py-1.5 rounded-lg border border-brand-200 transition cursor-pointer"
                                >
                                  ✨ Insert AI Suggested Description
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Photo attached to grievance report.</p>
                          )}

                          <div>
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
                            >
                              <span>✕</span> Remove Photo
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Dropdown */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="grievance-category-select" className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <span className="text-lg">🏷️</span>
                    <span>Category</span>
                  </label>
                  {category ? (
                    <button
                      type="button"
                      onClick={() => setCategory('')}
                      className="text-xs text-brand-600 hover:text-brand-700 font-semibold cursor-pointer"
                    >
                      Reset to Auto-detect
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500 font-medium">Auto-detected by AI if unselected</span>
                  )}
                </div>
                <select
                  id="grievance-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white transition shadow-xs font-medium cursor-pointer"
                >
                  <option value="">🤖 Auto-detect by AI (Default)</option>
                  <option value="waterlogging">🌊 Waterlogging / Flooding</option>
                  <option value="blocked_drain">🛑 Blocked Drain / Sewage Overflow</option>
                  <option value="water_supply">💧 Water Supply</option>
                  <option value="electricity">⚡ Electricity Board</option>
                  <option value="roads">🛣️ Public Works (Roads)</option>
                  <option value="sanitation">🚯 Sanitation & Sewage</option>
                  <option value="public_safety">🛡️ Public Safety / Hazards</option>
                  <option value="street_lights">💡 Street Lighting</option>
                  <option value="garbage_waste">🗑️ Solid Waste Management</option>
                </select>
              </div>

              {/* Complaint Text */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <span className="text-lg">📝</span>
                    <span>Complaint Details</span>
                  </label>
                  <span className={`text-xs font-medium ${text.trim().length < 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {text.trim().length} / 2000 chars (min 20)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Describe what the issue is, exact landmark, and how long it has persisted. Example: A water main leak opposite the school on Anna Salai is flooding the street."
                  className="w-full border border-gray-300 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white transition shadow-xs"
                />
              </div>

              {/* Location Picker with OpenStreetMap & GPS */}
              <LocationPicker
                selectedLocation={selectedLocation}
                onLocationChange={setSelectedLocation}
                showToast={showToast}
              />

              {rejectedCount >= 2 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="font-bold">Anti-Abuse Notice</p>
                    <p>
                      Multiple out-of-scope complaints were rejected. Please verify you are reporting municipal public
                      infrastructure issues to keep your reputation score intact.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="font-bold mb-0.5">Submission Error</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || analyzingImage}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-xl">⚙️</span> Submitting…
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </form>
          </div>

          {/* Side Guidance */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-xl">📋</span>
                <span>Validation Guide</span>
              </h3>
              <div className="space-y-3.5 text-xs">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-emerald-900">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <span className="text-base">✅</span>
                    <span>Valid Civic Issues:</span>
                  </p>
                  <p className="italic mb-2">"{VALID_COMPLAINT_EXAMPLE}"</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Water Supply', 'Electricity', 'Roads', 'Sanitation', 'Street Lights', 'Garbage', 'Safety'].map((c) => (
                      <span key={c} className="bg-white text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 font-semibold">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-900">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <span className="text-base">❌</span>
                    <span>Out-of-Scope (Auto-rejected):</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-rose-800 font-medium">
                    <li>Personal theft / crimes → Police FIR</li>
                    <li>Job / employment requests</li>
                    <li>Private landlord / tenant disputes</li>
                    <li>Political party opinions</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-xs text-blue-900">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <span className="text-xl">📱</span>
                <span>Automatic SMS Updates</span>
              </h4>
              <p className="text-blue-800 leading-relaxed font-medium">
                You will receive instant SMS notifications to your registered mobile number for every status change, department assignment, and field officer resolution note.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPLAINTS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-7">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <span>Complaints</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Live Sync Active
              </span>
              <button
                onClick={() => loadData(false)}
                title="Refresh"
                className="text-base p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 transition cursor-pointer font-bold flex items-center justify-center shadow-xs"
              >
                🔄
              </button>
            </div>
          </div>

          {grievances.length === 0 ? (
            <div className="text-center py-14 text-gray-500 text-sm">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-semibold text-gray-700">You have not submitted any complaints yet.</p>
              <button
                onClick={() => setActiveTab('submit')}
                className="mt-4 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 cursor-pointer shadow transition"
              >
                Write First Grievance
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {grievances.map((g) => {
                const statusInfo = STATUS_CONFIG[g.status] || STATUS_CONFIG.unsolved
                const latestUp = g.latest_update || (g.updates && g.updates[0])

                return (
                  <div
                    key={g.id}
                    className="border border-gray-200 hover:border-brand-400 rounded-2xl p-5 sm:p-6 transition bg-white shadow-xs hover:shadow-md space-y-4"
                  >
                    {/* Header: Category, Department, Status Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-3xl shadow-xs">
                          {CATEGORY_ICONS[g.category] || '🏛️'}
                        </div>
                        <div>
                          <div className="font-bold text-base text-gray-900 uppercase tracking-wide">
                            {CATEGORY_NAMES[g.category] || g.category?.replace('_', ' ')}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {g.department || 'Assigned to Municipal Office'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-xs font-bold px-3.5 py-1.5 rounded-full border inline-flex items-center gap-2 ${statusInfo.badge}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </span>

                        <button
                          onClick={() => viewGrievanceDetails(g.id)}
                          className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer border border-brand-200 flex items-center gap-1.5"
                        >
                          <span className="text-sm">🔍</span>
                          <span>Timeline ({g.updates?.length || (latestUp ? 1 : 0)})</span>
                        </button>
                      </div>
                    </div>

                    {/* Complaint Text */}
                    <p className="text-sm text-gray-800 leading-relaxed bg-gray-50/80 p-4 rounded-xl border border-gray-100 font-medium">
                      {g.text}
                    </p>

                    {/* Latest Progress & Admin Notice */}
                    {latestUp && (
                      <div className={`p-4 rounded-2xl border ${statusInfo.bgLight} space-y-2`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📢</span>
                            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                              Latest Progress & Officer Notice
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">
                            {new Date(latestUp.timestamp).toLocaleDateString()} {new Date(latestUp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {latestUp.message && (
                          <p className="text-sm font-semibold text-gray-800 italic pl-2.5 border-l-2 border-brand-500">
                            "{latestUp.message}"
                          </p>
                        )}

                        {latestUp.progress_image_url && (
                          <div className="mt-2.5 pt-2.5 border-t border-gray-200/60">
                            <p className="text-xs font-bold text-emerald-800 mb-1.5 flex items-center gap-1.5">
                              <span className="text-base">📸</span>
                              <span>Field Progress Photo Uploaded by Authority:</span>
                            </p>
                            <div className="inline-block relative group cursor-pointer" onClick={() => setPreviewPhotoModal(latestUp.progress_image_url)}>
                              <img
                                src={latestUp.progress_image_url}
                                alt="Field Progress"
                                className="h-32 w-48 object-cover rounded-xl border border-emerald-300 shadow-sm group-hover:opacity-90 transition"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white text-xs font-bold transition">
                                🔍 Click to Enlarge
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 pt-3 border-t border-gray-100 font-medium">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-gray-700 font-semibold flex items-center gap-1">
                          <span className="text-sm">⚡</span> Urgency: <strong className="text-brand-700">{g.urgency_score}/10</strong>
                        </span>
                        {g.location && (
                          <span className="flex items-center gap-1">
                            <span className="text-sm">📍</span> {g.location}
                          </span>
                        )}
                        {g.image_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal(g.image_url)}
                            className="text-brand-600 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span className="text-base">📷</span> View Photo
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {g.is_duplicate && (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                            👥 Area Cluster Linked
                          </span>
                        )}
                        <span className="text-gray-400">
                          {new Date(g.created_at).toLocaleDateString()} {new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SMS */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-7">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">🔔</span>
                <span>SMS</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Live SMS Active
              </span>
              <button
                onClick={() => loadData(false)}
                title="Refresh"
                className="text-base p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 transition cursor-pointer font-bold flex items-center justify-center shadow-xs"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-5 pb-3.5 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-500 mr-1">Filter:</span>
            {['all', 'water_supply', 'electricity', 'roads', 'sanitation', 'street_lights', 'public_safety', 'garbage_waste', 'waterlogging', 'blocked_drain'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterNotifCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition cursor-pointer capitalize ${
                  filterNotifCategory === cat
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? 'All SMS' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="text-center py-14 text-gray-500 text-sm">
              <p className="text-4xl mb-3">💬</p>
              <p className="font-semibold text-gray-700">No SMS notices found in this category.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredNotifications.map((n) => {
                const isResolution = n.message.includes('SOLVED') || n.message.includes('resolved')
                const isInProgress = n.message.includes('IN_PROGRESS') || n.message.includes('progress')
                const isReclassified = n.message.includes('reclassified') || n.message.includes('reassigned')

                return (
                  <div
                    key={n.id}
                    onClick={() => n.grievance_id && viewGrievanceDetails(n.grievance_id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                      n.grievance_id ? 'cursor-pointer hover:shadow-md hover:border-brand-400 group' : ''
                    } ${
                      isResolution
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : isInProgress
                        ? 'bg-blue-50/60 border-blue-200'
                        : isReclassified
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">📱</span>
                        <span className="text-xs font-bold bg-blue-900 text-white px-2.5 py-0.5 rounded-md tracking-wider">
                          GOV-SMS
                        </span>
                        <span className="text-xs font-bold text-gray-700">
                          To: {n.phone || 'Citizen Mobile'}
                        </span>
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                          ✓ Delivered
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(n.created_at || n.timestamp).toLocaleDateString()} {new Date(n.created_at || n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-900 font-medium leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: View Grievance Progress Timeline & Progress Photos */}
      {selectedGrievance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-3xl shadow-xs">
                  {CATEGORY_ICONS[selectedGrievance.category] || '🏛️'}
                </div>
                <div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_CONFIG[selectedGrievance.status]?.badge || 'bg-gray-100 text-gray-800'}`}>
                    {selectedGrievance.status?.replace('_', ' ').toUpperCase()}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">
                    {CATEGORY_NAMES[selectedGrievance.category] || selectedGrievance.category?.replace('_', ' ')} · {selectedGrievance.department}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedGrievance(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-800 bg-gray-50 p-4 rounded-xl border border-gray-200 font-medium">
              {selectedGrievance.text}
            </p>

            {selectedGrievance.location && (
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <span className="text-base">📍</span> Location: {selectedGrievance.location}
              </p>
            )}

            {selectedGrievance.image_url && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                  <span className="text-base">📸</span> Uploaded Complaint Evidence:
                </p>
                <img
                  src={selectedGrievance.image_url}
                  alt="Complaint evidence"
                  onClick={() => setPreviewPhotoModal(selectedGrievance.image_url)}
                  className="h-44 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 transition shadow-xs"
                />
              </div>
            )}

            {/* Audit updates timeline with progress photos */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3.5 flex items-center gap-2">
                <span className="text-xl">🛠️</span>
                <span>Resolution Progress Timeline & SMS Audit</span>
              </h4>

              {selectedGrievance.updates?.length === 0 ? (
                <p className="text-xs text-gray-500 italic bg-gray-50 p-3.5 rounded-xl">
                  No field team notes logged yet. Scheduled for inspection.
                </p>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-gray-200">
                  {selectedGrievance.updates?.map((up) => (
                    <div key={up.id} className="relative pl-8">
                      <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-brand-600 border-2 border-white" />
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800 uppercase tracking-wide">
                            {up.status?.replace('_', ' ')}
                          </span>
                          <span className="text-gray-500 font-medium">
                            {new Date(up.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {up.message && <p className="text-sm text-gray-800 font-medium">{up.message}</p>}
                        {up.progress_image_url && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs font-bold text-emerald-800 mb-1.5 flex items-center gap-1">
                              <span className="text-base">📸</span> Field Progress Photo:
                            </p>
                            <img
                              src={up.progress_image_url}
                              alt="Progress"
                              onClick={() => setPreviewPhotoModal(up.progress_image_url)}
                              className="h-36 object-cover rounded-xl border border-gray-300 cursor-pointer hover:opacity-90 transition"
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

      {/* Modal: Fullscreen Photo Preview */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewPhotoModal}
              alt="Full Preview"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain border border-white/20 shadow-2xl"
            />
            <button
              onClick={() => setPreviewPhotoModal(null)}
              className="mt-3.5 px-5 py-2 bg-white text-gray-900 rounded-xl font-bold text-xs shadow hover:bg-gray-100 cursor-pointer"
            >
              ✕ Close Image Preview
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
