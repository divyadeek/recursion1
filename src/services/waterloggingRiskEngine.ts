/**
 * Explainable Evidence-Fusion Waterlogging Risk Engine for FloodOps Module
 *
 * NOTE:
 * This module does NOT train or claim a deep-learning flood model.
 * It is an explainable, multi-factor evidence-fusion engine that transparently fuses:
 * 1. Meteorological telemetry (Open-Meteo rainfall metrics or fallback proxy)
 * 2. Nearby citizen grievance reports & report credibility scores
 * 3. Verified duplicate complaint clusters & depth
 * 4. Local environmental & drainage context (DEMO_ENVIRONMENTAL_CONTEXTS)
 * 5. Gemini AI vision/text classification confidence
 *
 * INFERRED RISK NOTICE:
 * "This is an inferred environmental-risk estimate, not a direct sensor measurement."
 */

import {
  DEMO_ENVIRONMENTAL_CONTEXTS,
  calculateGeodesicDistanceKm,
  type EnvironmentalContextRecord,
} from '../data/environmentalContextDemo'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ConfidenceLabel = 'low' | 'medium' | 'high'

export interface RainfallContext {
  last1hMm: number
  last3hMm: number
  last6hMm: number
  last24hMm: number
  next3hMm: number
  next6hMm: number
  source: string
  isDemoFallback: boolean
  dataFreshnessMinutes?: number
  lastUpdated?: string
}

export interface GrievanceRecord {
  id: string
  user_id: string
  text?: string | null
  image_url?: string | null
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  category: string
  department?: string | null
  urgency_score: number
  confidence: number
  status: string
  is_duplicate: boolean
  similar_complaint_ids: string[]
  created_at: string
  reportCredibility?: {
    score: number
    label: string
    reasons: string[]
    recommendedNextStep: string
  } | null
}

export interface RiskFactorBreakdown {
  recentRainfall: {
    score: number // 0-100
    weight: number // 0.30
    weightedContribution: number // 0-30
    details: string
    metrics: {
      last1hMm: number
      last3hMm: number
      last6hMm: number
      last24hMm: number
    }
  }
  credibleReports: {
    score: number // 0-100
    weight: number // 0.25
    weightedContribution: number // 0-25
    details: string
    reportCount: number
    meanCredibility: number
    meanUrgency: number
  }
  duplicateCluster: {
    score: number // 0-100
    weight: number // 0.15
    weightedContribution: number // 0-15
    details: string
    duplicateReportsCount: number
    maxClusterSize: number
  }
  historicalHotspot: {
    score: number // 0-100
    weight: number // 0.15
    weightedContribution: number // 0-15
    details: string
    hotspotScore: number
  }
  drainageVulnerability: {
    score: number // 0-100
    weight: number // 0.10
    weightedContribution: number // 0-10
    details: string
    drainageScore: number
  }
  forecastRainfall: {
    score: number // 0-100
    weight: number // 0.05
    weightedContribution: number // 0-5
    details: string
    metrics: {
      next3hMm: number
      next6hMm: number
    }
  }
}

export interface ConfidenceFactorBreakdown {
  independentReportCount: {
    score: number // 0-25
    max: 25
    details: string
    distinctCitizens: number
  }
  reportFreshness: {
    score: number // 0-15
    max: 15
    details: string
    newestReportHoursAgo: number | null
  }
  photoAndAiConfidence: {
    score: number // 0-20
    max: 20
    details: string
    hasPhotos: boolean
    photoCount: number
    meanAiConfidence: number
  }
  weatherDataAvailability: {
    score: number // 0-15
    max: 15
    details: string
    source: string
    isFallback: boolean
  }
  environmentalContextAvailability: {
    score: number // 0-15
    max: 15
    details: string
    areaId: string
    distanceKm: number
  }
  rainReportAgreement: {
    score: number // 0-10
    max: 10
    details: string
    correlationStatus: string
  }
}

export interface ProvenanceItem {
  source: string
  metric: string
  timestamp: string
  isFallback: boolean
  details: string
}

export type OperationStatus =
  | 'pending'
  | 'verification_requested'
  | 'dispatched'
  | 'in_progress'
  | 'resolved'
  | 'false_alarm'

export interface FloodRiskCell {
  cellId: string
  areaId: string
  areaName: string
  coordinates: {
    latitude: number
    longitude: number
  }
  bounds: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }
  waterloggingRisk: number // 0 to 100
  riskLevel: RiskLevel
  confidence: number // 0 to 100
  confidenceLabel: ConfidenceLabel
  evidence: string[]
  provenance: ProvenanceItem[]
  linkedComplaintIds: string[]
  recommendedAction: string
  suggestedResponseTime: string
  rainfallSummary: string
  credibleReportsCount: number
  duplicateCount: number
  maxUrgency: number
  newestReportTime: number | null
  evidenceSummary: string
  rank?: number
  operationStatus?: OperationStatus
  operationRecord?: any
  predictionHorizon: 'next 3 hours'
  lastUpdated: string
  disclaimer: 'This is an inferred environmental-risk estimate, not a direct sensor measurement.'
  riskBreakdown: RiskFactorBreakdown
  confidenceBreakdown: ConfidenceFactorBreakdown
}

export interface FloodRiskOverviewResponse {
  predictionHorizon: 'next 3 hours'
  disclaimer: 'This is an inferred environmental-risk estimate, not a direct sensor measurement.'
  lastUpdated: string
  totalCells: number
  cells: FloodRiskCell[]
  summary: {
    criticalRiskCount: number
    highRiskCount: number
    mediumRiskCount: number
    lowRiskCount: number
    highConfidenceCount: number
    mediumConfidenceCount: number
    lowConfidenceCount: number
    totalLinkedComplaints: number
    actionBreakdown: {
      dispatchDrainageTeam: number
      fieldVerificationPatrol: number
      monitorReassess: number
      coverageGapRequestEvidence: number
      routineMonitoring: number
    }
  }
}

const INFERRED_DISCLAIMER =
  'This is an inferred environmental-risk estimate, not a direct sensor measurement.' as const

/**
 * Returns true if a grievance indicates waterlogging, drainage blockage, or flood-related sanitation.
 */
export function isFloodRelevant(g: GrievanceRecord): boolean {
  if (!g || !g.category) return false
  if (g.category === 'waterlogging' || g.category === 'blocked_drain') return true
  if (g.category === 'sanitation') {
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

/**
 * Normalizes recent rainfall into a 0-100 risk score based on urban runoff thresholds.
 * Thresholds:
 * - 1h rain: 25 mm/h max benchmark
 * - 3h rain: 45 mm max benchmark
 * - 6h rain: 65 mm max benchmark
 * - 24h rain: 100 mm max benchmark
 */
export function calculateRecentRainfallSubscore(rain: RainfallContext): {
  score: number
  details: string
} {
  const r1 = Math.max(0, rain.last1hMm || 0)
  const r3 = Math.max(0, rain.last3hMm || 0)
  const r6 = Math.max(0, rain.last6hMm || 0)
  const r24 = Math.max(0, rain.last24hMm || 0)

  const s1 = (Math.min(r1, 25) / 25) * 35
  const s3 = (Math.min(r3, 45) / 45) * 25
  const s6 = (Math.min(r6, 65) / 65) * 20
  const s24 = (Math.min(r24, 100) / 100) * 20

  const score = Math.min(100, Math.round(s1 + s3 + s6 + s24))
  const details = `Past rain: ${r1.toFixed(1)}mm (1h), ${r3.toFixed(1)}mm (3h), ${r6.toFixed(1)}mm (6h), ${r24.toFixed(1)}mm (24h).`
  return { score, details }
}

/**
 * Normalizes forecast rainfall into a 0-100 risk score based on short-term accumulation.
 */
export function calculateForecastRainfallSubscore(rain: RainfallContext): {
  score: number
  details: string
} {
  const f3 = Math.max(0, rain.next3hMm || 0)
  const f6 = Math.max(0, rain.next6hMm || 0)

  const s3 = (Math.min(f3, 20) / 20) * 65
  const s6 = (Math.min(f6, 40) / 40) * 35

  const score = Math.min(100, Math.round(s3 + s6))
  const details = `Forecast rain: ${f3.toFixed(1)}mm (next 3h), ${f6.toFixed(1)}mm (next 6h).`
  return { score, details }
}

/**
 * Normalizes nearby credible citizen complaints into a 0-100 risk score.
 */
export function calculateCredibleReportsSubscore(reports: GrievanceRecord[]): {
  score: number
  details: string
  meanCredibility: number
  meanUrgency: number
} {
  if (reports.length === 0) {
    return {
      score: 0,
      details: 'No active flood-relevant citizen reports filed in this cell.',
      meanCredibility: 0,
      meanUrgency: 0,
    }
  }

  let totalCred = 0
  let totalUrg = 0

  for (const g of reports) {
    const credScore =
      g.reportCredibility && typeof g.reportCredibility.score === 'number'
        ? g.reportCredibility.score
        : typeof g.confidence === 'number'
          ? Math.round(g.confidence * 80)
          : 60
    totalCred += credScore
    totalUrg += g.urgency_score || 5
  }

  const meanCredibility = Math.round(totalCred / reports.length)
  const meanUrgency = Math.round((totalUrg / reports.length) * 10) / 10

  // Volume scale: 1 report = 40%, 2 reports = 70%, 3+ reports = 100%
  const volumeMultiplier = reports.length >= 3 ? 1.0 : reports.length === 2 ? 0.75 : 0.45

  const credContribution = (meanCredibility / 100) * volumeMultiplier * 80
  const urgContribution = (meanUrgency / 10) * 20

  const score = Math.min(100, Math.round(credContribution + urgContribution))
  const details = `${reports.length} report(s) in cell (mean credibility: ${meanCredibility}/100, mean urgency: ${meanUrgency}/10).`

  return { score, details, meanCredibility, meanUrgency }
}

/**
 * Calculates subscore for nearby duplicate complaint clusters.
 */
export function calculateDuplicateClusterSubscore(reports: GrievanceRecord[]): {
  score: number
  details: string
  duplicateReportsCount: number
  maxClusterSize: number
} {
  const duplicateReports = reports.filter(
    (g) => g.is_duplicate || (Array.isArray(g.similar_complaint_ids) && g.similar_complaint_ids.length > 0)
  )

  if (duplicateReports.length === 0) {
    return {
      score: 0,
      details: 'No active duplicate clusters detected in cell.',
      duplicateReportsCount: 0,
      maxClusterSize: 0,
    }
  }

  let maxClusterSize = 1
  for (const g of duplicateReports) {
    const simCount = (g.similar_complaint_ids?.length || 0) + 1
    if (simCount > maxClusterSize) {
      maxClusterSize = simCount
    }
  }

  const rawScore = duplicateReports.length * 25 + (maxClusterSize - 1) * 20
  const score = Math.min(100, Math.round(rawScore))
  const details = `${duplicateReports.length} duplicate report(s) found across cluster depth of up to ${maxClusterSize} complaints.`

  return {
    score,
    details,
    duplicateReportsCount: duplicateReports.length,
    maxClusterSize,
  }
}

/**
 * Calculates the 6 confidence factors (summing up to 100).
 */
export function calculateConfidenceScore(
  reports: GrievanceRecord[],
  rain: RainfallContext,
  context: EnvironmentalContextRecord,
  distanceToContextKm: number
): {
  confidence: number
  confidenceLabel: ConfidenceLabel
  breakdown: ConfidenceFactorBreakdown
  evidenceEntries: string[]
} {
  const evidenceEntries: string[] = []

  // 1. Nearby independent report count (0-25)
  const uniqueCitizens = new Set(reports.map((g) => g.user_id).filter(Boolean))
  const distinctCount = uniqueCitizens.size
  let reportCountScore = 0
  if (distinctCount >= 3) {
    reportCountScore = 25
  } else if (distinctCount === 2) {
    reportCountScore = 18
  } else if (distinctCount === 1) {
    reportCountScore = 12
  } else {
    reportCountScore = 0
  }
  const reportCountDetails = `${distinctCount} distinct reporting citizen(s) within cell vicinity.`
  if (distinctCount > 0) {
    evidenceEntries.push(`Citizen evidence: ${distinctCount} independent reporting citizen(s) (${reports.length} total complaints).`)
  }

  // 2. Report freshness (0-15)
  let freshnessScore = 0
  let newestHoursAgo: number | null = null
  if (reports.length > 0) {
    const now = Date.now()
    const ages = reports.map((g) => {
      const t = new Date(g.created_at).getTime()
      return isNaN(t) ? 24 : Math.max(0, (now - t) / (1000 * 3600))
    })
    newestHoursAgo = Math.round(Math.min(...ages) * 10) / 10

    if (newestHoursAgo <= 2) {
      freshnessScore = 15
    } else if (newestHoursAgo <= 6) {
      freshnessScore = 12
    } else if (newestHoursAgo <= 24) {
      freshnessScore = 8
    } else {
      freshnessScore = 4
    }
    evidenceEntries.push(`Report freshness: Most recent complaint received ${newestHoursAgo}h ago.`)
  } else {
    freshnessScore = 0
  }
  const freshnessDetails =
    newestHoursAgo !== null
      ? `Newest report filed ~${newestHoursAgo} hours ago.`
      : 'No active reports in this cell to evaluate freshness.'

  // 3. Photo & Gemini confidence (0-20)
  let photoAiScore = 0
  const photoCount = reports.filter((g) => Boolean(g.image_url)).length
  const hasPhotos = photoCount > 0
  if (reports.length > 0) {
    if (hasPhotos) {
      photoAiScore += 10
      evidenceEntries.push(`Visual verification: ${photoCount} complaint(s) corroborated by photographic evidence.`)
    }
    const totalAiConf = reports.reduce((acc, g) => acc + (typeof g.confidence === 'number' ? g.confidence : 0.7), 0)
    const meanAiConf = Math.round((totalAiConf / reports.length) * 100) / 100

    if (meanAiConf >= 0.85) {
      photoAiScore += 10
    } else if (meanAiConf >= 0.7) {
      photoAiScore += 7
    } else if (meanAiConf >= 0.5) {
      photoAiScore += 4
    } else {
      photoAiScore += 1
    }
    evidenceEntries.push(`Gemini AI evidence confidence: Average classification confidence ${Math.round(meanAiConf * 100)}%.`)
  }
  const photoAiDetails =
    reports.length > 0
      ? `${photoCount} photographic attachment(s); average Gemini classification confidence ${Math.round(
          (reports.reduce((acc, g) => acc + (g.confidence || 0.7), 0) / reports.length) * 100
        )}%.`
      : 'No citizen media or vision verification available.'

  // 4. Weather data availability & freshness (0-15)
  let weatherScore = 0
  if (!rain.isDemoFallback) {
    const age = rain.dataFreshnessMinutes ?? 0
    if (age <= 30) {
      weatherScore = 15
    } else if (age <= 90) {
      weatherScore = 12
    } else {
      weatherScore = 10
    }
  } else {
    // Transparently score demo fallback proxy
    weatherScore = 8
  }
  const weatherDetails = rain.isDemoFallback
    ? 'Telemetry from demo weather proxy (heuristic fallback).'
    : `Live Open-Meteo precipitation stream (${rain.dataFreshnessMinutes ?? 0}m freshness).`
  evidenceEntries.push(`Meteorological source: ${weatherDetails}`)

  // 5. Environmental & drainage context availability (0-15)
  let envScore = 0
  if (distanceToContextKm <= 2.0) {
    envScore = 15
  } else if (distanceToContextKm <= 4.5) {
    envScore = 10
  } else {
    envScore = 5
  }
  const envDetails = `Matched local environmental baseline "${context.areaName}" (${distanceToContextKm.toFixed(
    1
  )} km from cell centroid).`
  evidenceEntries.push(
    `Environmental context: Localized to ${context.areaName} (hotspot score: ${context.historicalHotspotScore}, drainage vulnerability: ${context.drainageVulnerability}).`
  )

  // 6. Agreement between rainfall and local reports (0-10)
  let agreementScore = 0
  let correlationStatus = ''
  const hasRain = (rain.last24hMm || 0) >= 5 || (rain.last3hMm || 0) >= 3
  const hasReports = reports.length > 0

  if (hasRain && hasReports) {
    agreementScore = 10
    correlationStatus = 'Strong multi-source agreement: Measured rainfall correlates with citizen inundation complaints.'
  } else if (!hasRain && hasReports) {
    // Check if complaints mention clogged/structural drainage
    const mentionsDrain = reports.some((g) => {
      const txt = (g.text || '').toLowerCase()
      return txt.includes('drain') || txt.includes('sewage') || txt.includes('overflow') || txt.includes('blocked')
    })
    if (mentionsDrain) {
      agreementScore = 8
      correlationStatus = 'Structural drain blockage agreement: Complaints identify non-meteorological drainage obstruction.'
    } else {
      agreementScore = 4
      correlationStatus = 'Mixed correlation: Citizen reports submitted with zero or minimal recorded recent rainfall.'
    }
  } else if (hasRain && !hasReports) {
    agreementScore = 6
    correlationStatus = 'Pre-report meteorological signal: Significant rainfall recorded without filed citizen complaints yet.'
  } else {
    // !hasRain && !hasReports
    agreementScore = 6
    correlationStatus = 'Calm baseline agreement: Zero recent precipitation and zero active waterlogging complaints.'
  }
  evidenceEntries.push(`Correlation: ${correlationStatus}`)

  const totalConfidence = Math.max(
    0,
    Math.min(100, reportCountScore + freshnessScore + photoAiScore + weatherScore + envScore + agreementScore)
  )

  let confidenceLabel: ConfidenceLabel
  if (totalConfidence >= 65) {
    confidenceLabel = 'high'
  } else if (totalConfidence >= 35) {
    confidenceLabel = 'medium'
  } else {
    confidenceLabel = 'low'
  }

  const breakdown: ConfidenceFactorBreakdown = {
    independentReportCount: {
      score: reportCountScore,
      max: 25,
      details: reportCountDetails,
      distinctCitizens: distinctCount,
    },
    reportFreshness: {
      score: freshnessScore,
      max: 15,
      details: freshnessDetails,
      newestReportHoursAgo: newestHoursAgo,
    },
    photoAndAiConfidence: {
      score: photoAiScore,
      max: 20,
      details: photoAiDetails,
      hasPhotos,
      photoCount,
      meanAiConfidence:
        reports.length > 0
          ? Math.round((reports.reduce((acc, g) => acc + (g.confidence || 0.7), 0) / reports.length) * 100) / 100
          : 0,
    },
    weatherDataAvailability: {
      score: weatherScore,
      max: 15,
      details: weatherDetails,
      source: rain.source,
      isFallback: rain.isDemoFallback,
    },
    environmentalContextAvailability: {
      score: envScore,
      max: 15,
      details: envDetails,
      areaId: context.areaId,
      distanceKm: distanceToContextKm,
    },
    rainReportAgreement: {
      score: agreementScore,
      max: 10,
      details: correlationStatus,
      correlationStatus,
    },
  }

  return {
    confidence: totalConfidence,
    confidenceLabel,
    breakdown,
    evidenceEntries,
  }
}

/**
 * Applies the mandated operational decision rules:
 * - high/critical risk + high confidence → dispatch drainage team
 * - high/critical risk + low confidence → request field verification patrol
 * - medium risk → monitor/reassess
 * - low-confidence/no-evidence zones → coverage gap / request more evidence
 * - never state that the area is definitely flooded
 * - show: "This is an inferred environmental-risk estimate, not a direct sensor measurement."
 */
export function determineRecommendedAction(
  riskLevel: RiskLevel,
  confidenceLabel: ConfidenceLabel,
  reportsCount: number
): string {
  if (riskLevel === 'high' || riskLevel === 'critical') {
    if (confidenceLabel === 'high' || confidenceLabel === 'medium') {
      return 'Dispatch drainage inspection team within 60 minutes.'
    } else {
      return 'Send field verification patrol within 2 hours.'
    }
  }

  if (riskLevel === 'medium') {
    return 'Monitor and refresh assessment.'
  }

  // riskLevel is 'low'
  if (confidenceLabel === 'low' || reportsCount === 0) {
    return 'Coverage gap — request local evidence or field check.'
  }

  return 'Routine monitoring — baseline drainage adequate.'
}

export function determineSuggestedResponseTime(
  riskLevel: RiskLevel,
  confidenceLabel: ConfidenceLabel,
  reportsCount: number
): string {
  if (riskLevel === 'high' || riskLevel === 'critical') {
    if (confidenceLabel === 'high' || confidenceLabel === 'medium') {
      return '< 60 mins'
    } else {
      return 'Within 2 hours'
    }
  }

  if (riskLevel === 'medium') {
    return 'Within 3–6 hours'
  }

  if (confidenceLabel === 'low' || reportsCount === 0) {
    return 'As evidence arrives'
  }

  return 'Routine / As needed'
}

export function generateEvidenceSummary(
  riskLevel: RiskLevel,
  rain: RainfallContext,
  linkedComplaints: GrievanceRecord[],
  context: EnvironmentalContextRecord,
  confidenceLabel: ConfidenceLabel
): string {
  const rainPart =
    rain.last24hMm > 0 ? `${rain.last24hMm.toFixed(1)}mm rain observed (24h)` : 'No recent rainfall recorded'
  const reportsCount = linkedComplaints.length
  const reportsPart =
    reportsCount > 0
      ? `${reportsCount} credible report${reportsCount > 1 ? 's' : ''}`
      : 'Zero citizen reports'
  const dupCount = linkedComplaints.filter((g) => g.is_duplicate).length
  const dupPart = dupCount > 0 ? `, ${dupCount} duplicate${dupCount > 1 ? 's' : ''}` : ''
  const hotspotPart =
    context.historicalHotspotScore >= 0.7
      ? '; known historical flood hotspot'
      : context.drainageVulnerability >= 0.7
      ? '; constrained storm drain capacity'
      : ''

  return `${rainPart}; ${reportsPart}${dupPart}${hotspotPart}. Confidence: ${confidenceLabel}.`
}

/**
 * Ranks cells prioritizing:
 * 1. high risk (descending)
 * 2. high confidence (descending)
 * 3. report urgency (descending)
 * 4. duplicate count (descending)
 * 5. report freshness (newest first)
 */
export function sortAndRankFloodRiskCells(cells: FloodRiskCell[]): FloodRiskCell[] {
  const sorted = [...cells].sort((a, b) => {
    // 1. High risk
    if (b.waterloggingRisk !== a.waterloggingRisk) {
      return b.waterloggingRisk - a.waterloggingRisk
    }
    // 2. High confidence
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence
    }
    // 3. Report urgency
    const urgA = a.maxUrgency ?? (a.riskBreakdown?.credibleReports?.meanUrgency || 0)
    const urgB = b.maxUrgency ?? (b.riskBreakdown?.credibleReports?.meanUrgency || 0)
    if (urgB !== urgA) {
      return urgB - urgA
    }
    // 4. Duplicate count
    const dupA = a.duplicateCount ?? (a.riskBreakdown?.duplicateCluster?.duplicateReportsCount || 0)
    const dupB = b.duplicateCount ?? (b.riskBreakdown?.duplicateCluster?.duplicateReportsCount || 0)
    if (dupB !== dupA) {
      return dupB - dupA
    }
    // 5. Report freshness
    const freshA = a.newestReportTime || 0
    const freshB = b.newestReportTime || 0
    return freshB - freshA
  })

  return sorted.map((cell, idx) => ({
    ...cell,
    rank: idx + 1,
  }))
}

/**
 * Assesses an individual geographic cell/area for waterlogging risk and evidence confidence.
 */
export function evaluateCellWaterloggingRisk(
  cellId: string,
  context: EnvironmentalContextRecord,
  allGrievances: GrievanceRecord[],
  rain: RainfallContext
): FloodRiskCell {
  const cellLat = context.latitude
  const cellLon = context.longitude

  // Find all flood-relevant citizen grievances within cell catchment (~3.0 km)
  const linkedComplaints: GrievanceRecord[] = []
  for (const g of allGrievances) {
    if (!isFloodRelevant(g)) continue
    const lat = typeof g.latitude === 'number' ? g.latitude : parseFloat(g.latitude as any)
    const lon = typeof g.longitude === 'number' ? g.longitude : parseFloat(g.longitude as any)

    if (!isNaN(lat) && !isNaN(lon)) {
      const distKm = calculateGeodesicDistanceKm(cellLat, cellLon, lat, lon)
      if (distKm <= 3.0) {
        linkedComplaints.push(g)
      }
    } else if (g.address || g.location) {
      const locText = `${g.address || ''} ${g.location || ''}`.toLowerCase()
      if (locText.includes(context.areaName.toLowerCase())) {
        linkedComplaints.push(g)
      }
    }
  }

  // --- Transparent Risk Sub-Scores (Weighted Factors) ---
  // 1. 30% recent rainfall (0-100)
  const recentRainSub = calculateRecentRainfallSubscore(rain)
  const recentRainContribution = Math.round(recentRainSub.score * 0.3 * 10) / 10

  // 2. 25% nearby credible flood-related citizen reports (0-100)
  const reportsSub = calculateCredibleReportsSubscore(linkedComplaints)
  const reportsContribution = Math.round(reportsSub.score * 0.25 * 10) / 10

  // 3. 15% nearby duplicate cluster size (0-100)
  const clusterSub = calculateDuplicateClusterSubscore(linkedComplaints)
  const clusterContribution = Math.round(clusterSub.score * 0.15 * 10) / 10

  // 4. 15% historical hotspot score (0-100)
  const hotspotScore = Math.min(100, Math.max(0, Math.round(context.historicalHotspotScore * 100)))
  const hotspotContribution = Math.round(hotspotScore * 0.15 * 10) / 10

  // 5. 10% drainage vulnerability (0-100)
  const drainageScore = Math.min(100, Math.max(0, Math.round(context.drainageVulnerability * 100)))
  const drainageContribution = Math.round(drainageScore * 0.1 * 10) / 10

  // 6. 5% forecast rainfall next 3h/6h (0-100)
  const forecastSub = calculateForecastRainfallSubscore(rain)
  const forecastContribution = Math.round(forecastSub.score * 0.05 * 10) / 10

  // Total Waterlogging Risk Score (0-100)
  const totalWaterloggingRisk = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        recentRainContribution +
          reportsContribution +
          clusterContribution +
          hotspotContribution +
          drainageContribution +
          forecastContribution
      )
    )
  )

  let riskLevel: RiskLevel
  if (totalWaterloggingRisk >= 70) {
    riskLevel = 'critical'
  } else if (totalWaterloggingRisk >= 45) {
    riskLevel = 'high'
  } else if (totalWaterloggingRisk >= 25) {
    riskLevel = 'medium'
  } else {
    riskLevel = 'low'
  }

  // --- Confidence Calculation ---
  const distanceToContextKm = 0.0 // Exactly coincident with context centroid
  const confResult = calculateConfidenceScore(linkedComplaints, rain, context, distanceToContextKm)

  // --- Evidence Synthesis ---
  const evidence: string[] = [
    ...confResult.evidenceEntries,
    `Recent rainfall risk contribution: ${recentRainContribution}/30 pts (${recentRainSub.details})`,
    `Citizen reporting risk contribution: ${reportsContribution}/25 pts (${reportsSub.details})`,
    `Duplicate clustering contribution: ${clusterContribution}/15 pts (${clusterSub.details})`,
    `Historical hotspot baseline contribution: ${hotspotContribution}/15 pts (Hotspot score: ${context.historicalHotspotScore})`,
    `Drainage vulnerability contribution: ${drainageContribution}/10 pts (Vulnerability score: ${context.drainageVulnerability})`,
    `Forecast rainfall contribution: ${forecastContribution}/5 pts (${forecastSub.details})`,
  ]

  // --- Provenance Attribution ---
  const nowIso = new Date().toISOString()
  const provenance: ProvenanceItem[] = [
    {
      source: rain.source,
      metric: 'Recent & Forecast Precipitation Telemetry',
      timestamp: rain.lastUpdated || nowIso,
      isFallback: rain.isDemoFallback,
      details: `${rain.last24hMm.toFixed(1)}mm observed past 24h, ${rain.next3hMm.toFixed(1)}mm forecast next 3h`,
    },
    {
      source: 'Citizen Grievance Portal Database',
      metric: 'Civic Complaint Intake, Urgency & Duplicate Detection',
      timestamp: nowIso,
      isFallback: false,
      details: `${linkedComplaints.length} flood-relevant complaints linked within 3.0 km`,
    },
    {
      source: 'Gemini Multimodal AI Classifier',
      metric: 'Image Verification & Category Confidence',
      timestamp: nowIso,
      isFallback: false,
      details: `${confResult.breakdown.photoAndAiConfidence.photoCount} attached photos analyzed`,
    },
    {
      source: context.sourceLabel,
      metric: 'Historical Hotspot & Drainage Vulnerability Baseline',
      timestamp: nowIso,
      isFallback: true,
      details: `${context.areaName} local terrain and watershed basin parameters`,
    },
  ]

  const recommendedAction = determineRecommendedAction(riskLevel, confResult.confidenceLabel, linkedComplaints.length)
  const suggestedResponseTime = determineSuggestedResponseTime(riskLevel, confResult.confidenceLabel, linkedComplaints.length)

  const rainfallSummary = `Past 1h: ${rain.last1hMm.toFixed(1)}mm | 24h: ${rain.last24hMm.toFixed(1)}mm | Next 3h: ${rain.next3hMm.toFixed(1)}mm`
  const duplicateCount = linkedComplaints.filter((g) => g.is_duplicate).length
  const maxUrgency = linkedComplaints.reduce((max, g) => Math.max(max, g.urgency_score || 0), 0)
  const newestReportTime =
    linkedComplaints.reduce((latest, g) => {
      const t = g.created_at ? new Date(g.created_at).getTime() : 0
      return t > latest ? t : latest
    }, 0) || null
  const evidenceSummary = generateEvidenceSummary(riskLevel, rain, linkedComplaints, context, confResult.confidenceLabel)

  // 500m x 500m bounding box (~250m from centroid in each direction)
  const DELTA_500M_LAT = 0.00225
  const DELTA_500M_LON = 0.00230
  const bounds = {
    minLat: Number((cellLat - DELTA_500M_LAT).toFixed(5)),
    maxLat: Number((cellLat + DELTA_500M_LAT).toFixed(5)),
    minLon: Number((cellLon - DELTA_500M_LON).toFixed(5)),
    maxLon: Number((cellLon + DELTA_500M_LON).toFixed(5)),
  }

  const riskBreakdown: RiskFactorBreakdown = {
    recentRainfall: {
      score: recentRainSub.score,
      weight: 0.3,
      weightedContribution: recentRainContribution,
      details: recentRainSub.details,
      metrics: {
        last1hMm: rain.last1hMm,
        last3hMm: rain.last3hMm,
        last6hMm: rain.last6hMm,
        last24hMm: rain.last24hMm,
      },
    },
    credibleReports: {
      score: reportsSub.score,
      weight: 0.25,
      weightedContribution: reportsContribution,
      details: reportsSub.details,
      reportCount: linkedComplaints.length,
      meanCredibility: reportsSub.meanCredibility,
      meanUrgency: reportsSub.meanUrgency,
    },
    duplicateCluster: {
      score: clusterSub.score,
      weight: 0.15,
      weightedContribution: clusterContribution,
      details: clusterSub.details,
      duplicateReportsCount: clusterSub.duplicateReportsCount,
      maxClusterSize: clusterSub.maxClusterSize,
    },
    historicalHotspot: {
      score: hotspotScore,
      weight: 0.15,
      weightedContribution: hotspotContribution,
      details: `Historical hotspot index: ${context.historicalHotspotScore}`,
      hotspotScore: context.historicalHotspotScore,
    },
    drainageVulnerability: {
      score: drainageScore,
      weight: 0.1,
      weightedContribution: drainageContribution,
      details: `Stormwater drain capacity vulnerability: ${context.drainageVulnerability}`,
      drainageScore: context.drainageVulnerability,
    },
    forecastRainfall: {
      score: forecastSub.score,
      weight: 0.05,
      weightedContribution: forecastContribution,
      details: forecastSub.details,
      metrics: {
        next3hMm: rain.next3hMm,
        next6hMm: rain.next6hMm,
      },
    },
  }

  return {
    cellId,
    areaId: context.areaId,
    areaName: context.areaName,
    coordinates: {
      latitude: cellLat,
      longitude: cellLon,
    },
    bounds,
    waterloggingRisk: totalWaterloggingRisk,
    riskLevel,
    confidence: confResult.confidence,
    confidenceLabel: confResult.confidenceLabel,
    evidence,
    provenance,
    linkedComplaintIds: linkedComplaints.map((g) => g.id),
    recommendedAction,
    suggestedResponseTime,
    rainfallSummary,
    credibleReportsCount: linkedComplaints.length,
    duplicateCount,
    maxUrgency,
    newestReportTime,
    evidenceSummary,
    operationStatus: 'pending',
    predictionHorizon: 'next 3 hours',
    lastUpdated: nowIso,
    disclaimer: INFERRED_DISCLAIMER,
    riskBreakdown,
    confidenceBreakdown: confResult.breakdown,
  }
}

/**
 * Computes waterlogging risk assessments across all monitored Chennai environmental cells.
 */
export function computeAllChennaiFloodRisks(
  allGrievances: GrievanceRecord[],
  defaultRain: RainfallContext,
  contexts: EnvironmentalContextRecord[] = DEMO_ENVIRONMENTAL_CONTEXTS
): FloodRiskOverviewResponse {
  const rawCells: FloodRiskCell[] = contexts.map((ctx) => {
    return evaluateCellWaterloggingRisk(`cell-${ctx.areaId}`, ctx, allGrievances, defaultRain)
  })

  // Rank cells prioritizing: high risk, high confidence, urgency, duplicates, freshness
  const cells = sortAndRankFloodRiskCells(rawCells)

  // Calculate high-level summary metrics
  const summary = {
    criticalRiskCount: cells.filter((c) => c.riskLevel === 'critical').length,
    highRiskCount: cells.filter((c) => c.riskLevel === 'high').length,
    mediumRiskCount: cells.filter((c) => c.riskLevel === 'medium').length,
    lowRiskCount: cells.filter((c) => c.riskLevel === 'low').length,
    highConfidenceCount: cells.filter((c) => c.confidenceLabel === 'high').length,
    mediumConfidenceCount: cells.filter((c) => c.confidenceLabel === 'medium').length,
    lowConfidenceCount: cells.filter((c) => c.confidenceLabel === 'low').length,
    totalLinkedComplaints: Array.from(new Set(cells.flatMap((c) => c.linkedComplaintIds))).length,
    actionBreakdown: {
      dispatchDrainageTeam: cells.filter((c) => c.recommendedAction.startsWith('Dispatch drainage inspection team')).length,
      fieldVerificationPatrol: cells.filter((c) => c.recommendedAction.startsWith('Send field verification patrol')).length,
      monitorReassess: cells.filter((c) => c.recommendedAction.startsWith('Monitor and refresh assessment')).length,
      coverageGapRequestEvidence: cells.filter((c) => c.recommendedAction.startsWith('Coverage gap')).length,
      routineMonitoring: cells.filter((c) => c.recommendedAction.startsWith('Routine monitoring')).length,
    },
  }

  return {
    predictionHorizon: 'next 3 hours',
    disclaimer: INFERRED_DISCLAIMER,
    lastUpdated: new Date().toISOString(),
    totalCells: cells.length,
    cells,
    summary,
  }
}
