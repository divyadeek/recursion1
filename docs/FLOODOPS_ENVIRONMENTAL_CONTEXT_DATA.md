# FloodOps Demo Environmental Context Data Source

> **IMPORTANT DISCLAIMER & NON-OFFICIAL STATUS NOTICE**
> 
> **This dataset is a local hackathon demonstration proxy.**
> - **NOT OFFICIAL GOVERNMENT DATA**: This data does **NOT** represent official data from the Greater Chennai Corporation (GCC), Chennai Smart City Limited (CSCL), Chennai Metropolitan Development Authority (CMDA), or the Tamil Nadu State Disaster Management Authority (TNSDMA).
> - **NOT SENSOR OR IOT TELEMETRY**: This dataset does **NOT** reflect live IoT flood sensor readings, electronic water level gauges, physical telemetry, or certified hydrological simulations.
> - **DEMO & PROTOTYPE USE ONLY**: The scores and risk proxies are synthetic, heuristic approximations compiled for academic, hackathon, and prototype evaluation of the upcoming **FloodOps** grievance prioritization engine.

---

## 1. Overview & Purpose

The **FloodOps** module in the Citizen Grievance Portal provides multi-factor assessment of civic reports concerning waterlogging, blocked stormwater drains, and sewage overflows. 

To demonstrate how the platform can correlate incoming citizen complaints with ambient geographic vulnerability, this local demo dataset provisions **12 Chennai-area locality contexts**. When a grievance is reported with GPS coordinates (or when an administrator reviews an area on the GIS map), the backend correlates the location with the nearest environmental context record to evaluate baseline risk.

---

## 2. Schema Specification

Each environmental context record conforms to the following schema:

| Field Name | Type | Allowed Range / Format | Description |
| :--- | :--- | :--- | :--- |
| `areaId` | `string` | e.g. `"chennai-velachery"` | Unique machine-readable identifier for the geographic area. |
| `areaName` | `string` | e.g. `"Velachery"` | Common display name of the Chennai locality. |
| `latitude` | `number` | `-90.0` to `90.0` | Representative geographic centroid latitude (WGS 84). |
| `longitude` | `number` | `-180.0` to `180.0` | Representative geographic centroid longitude (WGS 84). |
| `historicalHotspotScore` | `number` | `0.0` to `1.0` | Heuristic frequency index of historical inundation during heavy northeast monsoons (1.0 = highest historical frequency). |
| `drainageVulnerability` | `number` | `0.0` to `1.0` | Stormwater drainage capacity strain index (1.0 = highly constrained or overburdened drainage). |
| `elevationProxy` | `number` | `0.0` to `1.0` | Relative low-lying basin vulnerability index where `1.0` represents a low-lying saucer basin / depression. |
| `lowLyingRisk` | `number` | `0.0` to `1.0` | Convenient alias for `elevationProxy`, ensuring backward and cross-component compatibility. |
| `sourceLabel` | `string` | Text | Attribution label identifying the dataset as a demonstration proxy. |
| `limitations` | `string` | Text | Explicit disclosure of modeling constraints and static assumptions. |
| `disclaimer` | `string` | Text | Standard safety disclaimer stating this is not an official municipal warning. |
| `notes` | `string` *(optional)* | Text | Qualitative notes explaining local terrain features (e.g. proximity to marshland, subways, or lake surplus courses). |

---

## 3. Included Chennai Localities (12 Areas)

The dataset contains 12 strategic localities across Chennai, covering central, southern, northern, and western zones:

1. **Velachery** (`chennai-velachery`): Adjoining Pallikaranai marshland and lake surplus channels; known saucer basin.
2. **T. Nagar** (`chennai-t-nagar`): High commercial density, subway dips, and impervious surface runoff.
3. **Guindy** (`chennai-guindy`): Transit hub and Kathipara junction drainage nexus.
4. **Adyar** (`chennai-adyar`): Coastal estuary basin and tidal river confluence.
5. **Anna Nagar** (`chennai-anna-nagar`): Planned sector with lower baseline vulnerability, with isolated subway dips.
6. **Tambaram** (`chennai-tambaram`): Southern gateway basin bordering Mudichur floodplains and lake cascades.
7. **Kodambakkam** (`chennai-kodambakkam`): Dense residential corridor discharging into Trustpuram canal network.
8. **Perambur** (`chennai-perambur`): North Chennai railway underpass catchment and Otteri Nullah drainage course.
9. **Madipakkam** (`chennai-madipakkam`): Wetland-fringe locality between lake boundaries and Pallikaranai marsh.
10. **Mylapore** (`chennai-mylapore`): Heritage urban core near Buckingham Canal with localized street ponding.
11. **Porur** (`chennai-porur`): Western catchment bordering Porur Lake and Mount-Poonamallee arterial link.
12. **Kolathur** (`chennai-kolathur`): North-west residential belt bordering Retteri lake and feeder channels.

---

## 4. Backend Helper & API Endpoints

### 4.1 TypeScript Backend Helper Function

Located in `/src/data/environmentalContextDemo.ts`:

```typescript
import {
  findNearestEnvironmentalContext,
  getAllEnvironmentalContexts,
  getEnvironmentalContextById
} from './src/data/environmentalContextDemo'

// Example: Finding nearest context for coordinates (12.9800, 80.2200)
const match = findNearestEnvironmentalContext(12.9800, 80.2200)
if (match) {
  console.log(`Closest area: ${match.context.areaName} (${match.distanceKm} km away)`)
  console.log(`Historical Hotspot Score: ${match.context.historicalHotspotScore}`)
}
```

### 4.2 REST API Endpoints

#### `GET /api/environment/flood-context/nearest?lat={latitude}&lon={longitude}`
Finds the closest demo environmental context record for the specified coordinates using geodesic distance calculation (Haversine formula).

**Query Parameters:**
- `lat` (required): Decimal latitude between -90 and 90.
- `lon` (required): Decimal longitude between -180 and 180.

**Response (200 OK):**
```json
{
  "areaId": "chennai-velachery",
  "areaName": "Velachery",
  "latitude": 12.9759,
  "longitude": 80.2212,
  "historicalHotspotScore": 0.94,
  "drainageVulnerability": 0.88,
  "elevationProxy": 0.91,
  "lowLyingRisk": 0.91,
  "sourceLabel": "Demo FloodOps Environmental Proxy (Hackathon Dataset)",
  "limitations": "Simulated heuristic proxy for hackathon prototype testing. Static values derived from general geographic landmarks and historical monsoon news accounts; does not capture active desilting, micro-drainage redesigns, or seasonal variations.",
  "disclaimer": "Hackathon demonstration proxy only. Not official Chennai municipal or government disaster management data. Not sourced from real-time physical sensors or certified flood-risk maps.",
  "notes": "Low-lying saucer basin adjoining Pallikaranai marshland and Velachery lake surplus channels. Highly prone to water stagnation during intense cloudbursts.",
  "distanceKm": 0.47,
  "context": { ... }
}
```

#### `GET /api/environment/flood-context`
Returns the list of all demo environmental context records, or resolves the nearest if `lat` and `lon` query parameters are supplied.

#### `GET /api/environment/flood-context/:areaId`
Returns a specific environmental context record by its identifier (e.g. `chennai-t-nagar`).

---

## 5. Example Context Record

```json
{
  "areaId": "chennai-velachery",
  "areaName": "Velachery",
  "latitude": 12.9759,
  "longitude": 80.2212,
  "historicalHotspotScore": 0.94,
  "drainageVulnerability": 0.88,
  "elevationProxy": 0.91,
  "lowLyingRisk": 0.91,
  "sourceLabel": "Demo FloodOps Environmental Proxy (Hackathon Dataset)",
  "limitations": "Simulated heuristic proxy for hackathon prototype testing. Static values derived from general geographic landmarks and historical monsoon news accounts; does not capture active desilting, micro-drainage redesigns, or seasonal variations.",
  "disclaimer": "Hackathon demonstration proxy only. Not official Chennai municipal or government disaster management data. Not sourced from real-time physical sensors or certified flood-risk maps.",
  "notes": "Low-lying saucer basin adjoining Pallikaranai marshland and Velachery lake surplus channels. Highly prone to water stagnation during intense cloudbursts."
}
```
