# AI-Powered Citizen Grievance Portal

A modern, full-stack civic grievance triage and citizen feedback management portal built with **React (Vite + Tailwind CSS)** and a unified **Node.js / Express backend with Google Gemini AI and OpenStreetMap GIS Mapping**.

Citizens can submit civic complaints with text descriptions, photo uploads with AI image drafting, and interactive GPS/map location selection. Google Gemini automatically validates whether the report is a legitimate public infrastructure issue, classifies the department, scores urgency (1–10), and merges spatial duplicate reports. Administrators can visualize reports on an interactive Leaflet GIS map with marker clustering, manage duplicate clusters, track turnaround times with Recharts analytics, upload progress proof photos, and broadcast status SMS updates.

---

## 🏗️ Architecture & Tech Stack

### **Frontend**
- **Core Framework**: React 18 (`react`, `react-dom`) with functional components & hooks
- **Build Tool & Bundler**: Vite 5 (`vite`, `@vitejs/plugin-react`)
- **Styling & UI**: Tailwind CSS 3, Lucide Icons, Motion transitions
- **GIS & Mapping (100% Free & Open-Source)**:
  - **Leaflet & React-Leaflet**: Interactive map rendering and custom HTML marker pins
  - **Leaflet.markercluster**: High-performance spatial clustering of grievance markers
  - **OpenStreetMap & Nominatim**: Free map tiles, forward address search, and GPS reverse geocoding
- **Data Visualization**: **Recharts** (Category Pie Charts, Status Distribution Bar Charts, and SLA Turnaround Time Line Charts)
- **HTTP Client**: Axios with global authentication interceptors

### **Backend & APIs**
- **Runtime & Language**: Node.js with TypeScript (`tsx` in development, `esbuild` for production bundles)
- **Web Framework**: Express 4 server integrated with Vite SPA middleware in `server.ts`
- **AI & Multimodal Intelligence**: Google GenAI SDK (`@google/genai` with Gemini models) for civic photo validation, automated text drafting, priority scoring, and semantic duplicate detection
- **Authentication**: JWT (`jsonwebtoken`) authentication with phone number / OTP verification & Role-Based Access Control (`citizen` / `admin`)
- **File Uploads**: Multer for grievance photos and resolution proof images
- **Data & Cache Layer**: In-memory state store with pre-seeded sample data, Nominatim rate-limiting, 24-hour geocode caching, and simulated SMS notification delivery

---

## 📁 Repository File Structure

```text
citizen-grievance-portal/
├── server.ts                      # Express REST API + Gemini AI + Geocoding proxies + Vite middleware
├── index.html                     # HTML entry point with Leaflet & Google Fonts
├── package.json                   # Dependencies, scripts (dev, build, start, lint)
├── tsconfig.json                  # TypeScript compiler configuration
├── vite.config.ts                 # Vite build & plugin setup
├── tailwind.config.js             # Tailwind CSS theme & typography configuration
├── postcss.config.js              # PostCSS configuration
├── metadata.json                  # Application metadata & capabilities
├── seed_grievance_db.sql          # PostgreSQL/Supabase database schema & sample seed data
├── .env.example                   # Environment variables template
├── uploads/                       # Storage directory for citizen & resolution photos
└── src/
    ├── main.jsx                   # React client bootstrap
    ├── App.jsx                    # App layout, navigation bar, auth session & notification bell
    ├── index.css                  # Global styles, Tailwind imports, Leaflet popup & marker animations
    ├── components/
    │   ├── AdminDashboard.jsx     # Admin management hub (All grievances, duplicate clusters, charts, map tab)
    │   ├── AdminMapDashboard.jsx  # Interactive GIS map view with Leaflet marker clustering & filters
    │   ├── GrievanceForm.jsx      # Citizen grievance filing form, camera AI draft, and submission history
    │   ├── LocationPicker.jsx     # OpenStreetMap location picker with address search & GPS locator
    │   ├── LoginForm.jsx          # Dual authentication: Password & Phone OTP verification
    │   ├── RegisterForm.jsx       # Citizen registration form with automatic reputation scoring
    │   └── NotificationToast.jsx  # Real-time alert toasts
    ├── services/
    │   └── api.js                 # Axios API client with endpoints for auth, grievances, and geocoding
    └── utils/
        └── validators.js          # Form, phone, email, and complaint text validation helpers
```

---

## ✨ Key Features

### 👤 For Citizens
- **AI-Powered Photo Upload**: Upload an image of a civic problem (pothole, water leak, garbage pile) to auto-verify validity and synthesize a ready-to-edit complaint description.
- **Interactive Location Selection**: Select issue location using live GPS or search any locality/landmark with OpenStreetMap autocomplete and visual pin confirmation.
- **Urgency & Classification Preview**: Live feedback on assigned department and urgency rating (1–10).
- **Anti-Abuse Reputation Engine**: Dynamic citizen reputation scoring to prevent frivolous submissions.
- **Real-Time Status & Notification Timeline**: View audit logs, status transitions (`unsolved`, `in_progress`, `solved`), and field progress photos.

### 🛡️ For Municipal Administrators
- **Interactive GIS Map Dashboard**:
  - Spatial visualization of all reported grievances on an OpenStreetMap base layer.
  - Smart marker clustering with count badges to highlight dense problem areas.
  - Category-specific pin badges and pulsing red halos for critical urgency issues (≥8/10).
  - Filter pins by category, status, urgency threshold, duplicate clusters, or text search.
  - Clickable pins with quick inspection and status update triggers.
- **Duplicate Cluster Management**: Identify and group identical complaints across citizens, resolve them in one click, and broadcast automated SMS notifications to all affected filers.
- **Visual SLA & Resolution Analytics**: Track department resolution turnaround times, category breakdown, and status distribution with Recharts.
- **Resolution Proof**: Upload field work completion photos when closing grievances.

---

## ⚡ Quick Start: Running Locally

### 1. Prerequisites
- **Node.js** (v18.x or v20.x recommended)
- **npm** (bundled with Node.js)

### 2. Installation
Clone the repository, navigate to the folder, and install dependencies:

```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file from the example template:

```bash
cp .env.example .env
```

Configure `.env`:
```env
PORT=3000
JWT_SECRET=your-secret-jwt-key-here
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If `GEMINI_API_KEY` is not configured, the portal automatically falls back to built-in local heuristics so that submission, classification, and all UI workflows remain 100% operational).*

### 4. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 👥 Demo Accounts

The portal comes pre-loaded with sample accounts for instant testing:

### 🛡️ Municipal Admin:
- **Phone**: `+919876543220` | **Password**: `Password123`
- **Phone**: `+919876543221` | **Password**: `Password123`

### 👤 Citizen Accounts:
- **Phone**: `+919876543210` | **Password**: `Password123`
- **Phone**: `+919876543214` | **Password**: `Password123`
- **Phone OTP Mode**: Enter any registered phone number; demo OTP is `123456`.

---

## 🌐 API Reference (Implemented in `server.ts`)

### Authentication
- `POST /api/auth/send-otp` - Dispatch phone OTP
- `POST /api/auth/verify-otp` - Verify OTP and generate JWT session
- `POST /api/auth/login` - Authenticate via phone and password
- `POST /api/auth/register` - Create a citizen account
- `GET /api/auth/me` - Fetch authenticated user profile & reputation score

### Citizen Grievances & AI
- `POST /api/grievances` - Submit grievance (text, image, location coordinates, address)
- `GET /api/grievances` - List current user's submitted grievances
- `GET /api/grievances/:id` - Fetch grievance details with status audit timeline
- `POST /api/ai/analyze-image` - Multimodal image verification and complaint draft generation
- `GET /api/notifications` - Retrieve notification / SMS broadcast history

### OpenStreetMap & Geocoding Proxies
- `GET /api/geocode/search?q=<query>` - Search place names and localities via Nominatim
- `GET /api/geocode/reverse?lat=<lat>&lon=<lon>` - Reverse geocode GPS coordinates to address

### Admin Management
- `GET /api/admin/grievances` - Filterable list of all grievances with filer contact information
- `PATCH /api/admin/grievances/:id/status` - Update status, upload resolution proof photo, and send SMS
- `PATCH /api/admin/grievances/:id/reclassify` - Manual/AI reclassification and department reassignment
- `GET /api/admin/duplicate-clusters` - Retrieve duplicate clusters across multiple citizens
- `PATCH /api/admin/duplicate-clusters/:id/status` - Bulk-resolve duplicate cluster & broadcast SMS
- `GET /api/admin/analytics` - Department SLA performance metrics & resolution timeline statistics

---

## 🛠️ Production Build

To compile and launch the production build:

```bash
npm run build
npm run start
```
