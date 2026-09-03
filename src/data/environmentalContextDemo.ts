/**
 * Demo Environmental Context Data for FloodOps Module
 * 
 * DISCLAIMER & NOTICE:
 * This dataset is a simulated, heuristic baseline proxy developed solely for
 * hackathon demonstrations and prototype testing. It does NOT constitute
 * official Greater Chennai Corporation (GCC), Chennai Smart City, or Tamil Nadu
 * State Disaster Management Authority (TNSDMA) flood zonation data, nor does it
 * represent direct physical sensor or hydrological gauge telemetry.
 */

export interface EnvironmentalContextRecord {
  areaId: string
  areaName: string
  latitude: number
  longitude: number
  /** Historical inundation/waterlogging frequency proxy (0 to 1) */
  historicalHotspotScore: number
  /** Stormwater drain capacity & runoff vulnerability proxy (0 to 1) */
  drainageVulnerability: number
  /** Low-lying basin index / elevation vulnerability proxy (0 to 1, where higher indicates lower-lying basin) */
  elevationProxy: number
  /** Low-lying risk alias (0 to 1, identical to elevationProxy for flexible consumer access) */
  lowLyingRisk: number
  /** Clear attribution label */
  sourceLabel: string
  /** Known limitations of the demo proxy */
  limitations: string
  /** Explicit disclaimer for hackathon / prototype use */
  disclaimer: string
  /** Local context notes describing the drainage basin */
  notes?: string
}

export interface NearestContextResult {
  context: EnvironmentalContextRecord
  distanceKm: number
}

const COMMON_SOURCE_LABEL = 'Demo FloodOps Environmental Proxy (Hackathon Dataset)'

const COMMON_LIMITATIONS =
  'Simulated heuristic proxy for hackathon prototype testing. Static values derived from general geographic landmarks and historical monsoon news accounts; does not capture active desilting, micro-drainage redesigns, or seasonal variations.'

const COMMON_DISCLAIMER =
  'Hackathon demonstration proxy only. Not official Chennai municipal or government disaster management data. Not sourced from real-time physical sensors or certified flood-risk maps.'

/**
 * 12 Chennai-area environmental context records including all required localities:
 * Velachery, T. Nagar, Guindy, Adyar, Anna Nagar, Tambaram, Kodambakkam, Perambur,
 * plus Madipakkam, Mylapore, Porur, and Kolathur.
 */
export const DEMO_ENVIRONMENTAL_CONTEXTS: EnvironmentalContextRecord[] = [
  {
    areaId: 'chennai-velachery',
    areaName: 'Velachery',
    latitude: 12.9759,
    longitude: 80.2212,
    historicalHotspotScore: 0.94,
    drainageVulnerability: 0.88,
    elevationProxy: 0.91,
    lowLyingRisk: 0.91,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Low-lying saucer basin adjoining Pallikaranai marshland and Velachery lake surplus channels. Highly prone to water stagnation during intense cloudbursts.',
  },
  {
    areaId: 'chennai-t-nagar',
    areaName: 'T. Nagar',
    latitude: 13.0418,
    longitude: 80.2341,
    historicalHotspotScore: 0.82,
    drainageVulnerability: 0.79,
    elevationProxy: 0.65,
    lowLyingRisk: 0.65,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Dense commercial district with heavy impervious surface area. Localized water stagnation at Usman Road, Bazullah Road, and rail subways.',
  },
  {
    areaId: 'chennai-guindy',
    areaName: 'Guindy',
    latitude: 13.0067,
    longitude: 80.2025,
    historicalHotspotScore: 0.68,
    drainageVulnerability: 0.62,
    elevationProxy: 0.54,
    lowLyingRisk: 0.54,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Major transit nexus and industrial estate boundary. Intermediate elevation with localized bottlenecks along Kathipara transit feeder paths.',
  },
  {
    areaId: 'chennai-adyar',
    areaName: 'Adyar',
    latitude: 13.0012,
    longitude: 80.2565,
    historicalHotspotScore: 0.73,
    drainageVulnerability: 0.70,
    elevationProxy: 0.78,
    lowLyingRisk: 0.78,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Coastal estuary proximity and Adyar river backwater confluence. Vulnerable during tidal surges coinciding with upstream reservoir discharges.',
  },
  {
    areaId: 'chennai-anna-nagar',
    areaName: 'Anna Nagar',
    latitude: 13.0878,
    longitude: 80.2155,
    historicalHotspotScore: 0.38,
    drainageVulnerability: 0.42,
    elevationProxy: 0.32,
    lowLyingRisk: 0.32,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Grid-planned residential sector with relatively robust stormwater main lines; lower overall hotspot score with isolated dip underpasses.',
  },
  {
    areaId: 'chennai-tambaram',
    areaName: 'Tambaram',
    latitude: 12.9249,
    longitude: 80.1478,
    historicalHotspotScore: 0.86,
    drainageVulnerability: 0.81,
    elevationProxy: 0.84,
    lowLyingRisk: 0.84,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Southern gateway basin adjacent to Mudichur floodplains and tributary lake cascades. Frequent flash accumulation during heavy northeast monsoon spells.',
  },
  {
    areaId: 'chennai-kodambakkam',
    areaName: 'Kodambakkam',
    latitude: 13.0524,
    longitude: 80.2256,
    historicalHotspotScore: 0.65,
    drainageVulnerability: 0.67,
    elevationProxy: 0.58,
    lowLyingRisk: 0.58,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'High-density urban layout draining into Trustpuram canal network. Railway subways and low-lying residential avenues prone to intermediate pooling.',
  },
  {
    areaId: 'chennai-perambur',
    areaName: 'Perambur',
    latitude: 13.1075,
    longitude: 80.2435,
    historicalHotspotScore: 0.78,
    drainageVulnerability: 0.76,
    elevationProxy: 0.72,
    lowLyingRisk: 0.72,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'North Chennai rail hub corridor along the Otteri Nullah catchment. Vulnerable subway passages and slower gravity discharge during coastal high tides.',
  },
  {
    areaId: 'chennai-madipakkam',
    areaName: 'Madipakkam',
    latitude: 12.9647,
    longitude: 80.1961,
    historicalHotspotScore: 0.90,
    drainageVulnerability: 0.87,
    elevationProxy: 0.89,
    lowLyingRisk: 0.89,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Wetland-fringe locality between Madipakkam lake and Pallikaranai marsh. Severe historic inundation during extended seasonal precipitation.',
  },
  {
    areaId: 'chennai-mylapore',
    areaName: 'Mylapore',
    latitude: 13.0339,
    longitude: 80.2678,
    historicalHotspotScore: 0.52,
    drainageVulnerability: 0.58,
    elevationProxy: 0.46,
    lowLyingRisk: 0.46,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Heritage urban core near Buckingham Canal. Moderate overall vulnerability with localized ponding around low street junctions and temple tank overflows.',
  },
  {
    areaId: 'chennai-porur',
    areaName: 'Porur',
    latitude: 13.0382,
    longitude: 80.1565,
    historicalHotspotScore: 0.69,
    drainageVulnerability: 0.64,
    elevationProxy: 0.60,
    lowLyingRisk: 0.60,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'Western catchment bordering Porur Lake and Mount-Poonamallee arterial link. Elevated risk near surplus surplus outflow paths.',
  },
  {
    areaId: 'chennai-kolathur',
    areaName: 'Kolathur',
    latitude: 13.1235,
    longitude: 80.2094,
    historicalHotspotScore: 0.80,
    drainageVulnerability: 0.77,
    elevationProxy: 0.75,
    lowLyingRisk: 0.75,
    sourceLabel: COMMON_SOURCE_LABEL,
    limitations: COMMON_LIMITATIONS,
    disclaimer: COMMON_DISCLAIMER,
    notes:
      'North-west residential belt bordering Retteri lake. Silt accumulation in feeder channels creates prolonged local waterlogging during monsoon.',
  },
]

/**
 * Calculates geodesic distance between two coordinate pairs in kilometers using the Haversine formula.
 */
export function calculateGeodesicDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Finds the nearest demo environmental context record for a given latitude and longitude.
 * 
 * @param lat Target latitude
 * @param lon Target longitude
 * @param contexts Optional dataset override, defaults to DEMO_ENVIRONMENTAL_CONTEXTS
 * @returns NearestContextResult containing the closest area record and distance in kilometers, or null if coordinates are invalid
 */
export function findNearestEnvironmentalContext(
  lat: number,
  lon: number,
  contexts: EnvironmentalContextRecord[] = DEMO_ENVIRONMENTAL_CONTEXTS
): NearestContextResult | null {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null
  }
  if (!Array.isArray(contexts) || contexts.length === 0) {
    return null
  }

  let closest: EnvironmentalContextRecord = contexts[0]
  let minDistance = calculateGeodesicDistanceKm(lat, lon, closest.latitude, closest.longitude)

  for (let i = 1; i < contexts.length; i++) {
    const item = contexts[i]
    const dist = calculateGeodesicDistanceKm(lat, lon, item.latitude, item.longitude)
    if (dist < minDistance) {
      minDistance = dist
      closest = item
    }
  }

  return {
    context: closest,
    distanceKm: Math.round(minDistance * 100) / 100,
  }
}

/**
 * Returns all demo environmental context records.
 */
export function getAllEnvironmentalContexts(): EnvironmentalContextRecord[] {
  return DEMO_ENVIRONMENTAL_CONTEXTS
}

/**
 * Retrieves a specific environmental context record by its areaId.
 */
export function getEnvironmentalContextById(areaId: string): EnvironmentalContextRecord | null {
  return DEMO_ENVIRONMENTAL_CONTEXTS.find((c) => c.areaId === areaId) || null
}
