# Cold Call Copilot — Phase 1: Frontend Foundation

**Cold Call Copilot** is a high-productivity B2B sales conversation workspace designed specifically for salespeople calling manufacturing businesses (precision machining, tooling, automotive OEM, metal fabrication, industrial automation).

The application assists sales professionals in preparing for discovery calls, capturing operational bottlenecks (spindle downtime, scrap rework, supplier lead times), and organizing structured follow-up actions.

---

## 1. Phase 1 Architecture & Strict Boundaries

Per the Phase 1 specifications, this prototype focuses purely on **frontend workflow, component architecture, state management, and ergonomic design**:

- **No Backend / Database**: No Supabase MCP or database connection is used. All data access is mediated through a dedicated `DataContext` backed by reactive browser state and `localStorage`.
- **No AI / Audio / Transcription**: No fake microphone listening or synthetic transcript simulation. The Call Workspace uses a clean manual discovery note-taking system and question tracking checklist.
- **Isolated Sample Data**: Realistic manufacturing prospect accounts (Apex Precision Machining, Vanguard Automation, etc.) are isolated in `src/data/mockData.ts` and can be easily swapped for Supabase tables in Phase 3.
- **Zero Broken Links or Deceptive Controls**: All buttons, filters, searches, forms, timers, and modals are fully functional within client state.

---

## 2. Technology Stack

- **React 18** with **Vite 6**
- **TypeScript 5.7** (strict mode, zero type errors)
- **Tailwind CSS 3.4** (custom B2B palette with slate neutrals & deep brand accent)
- **React Router 6** (`BrowserRouter` with nested layouts and active navigation states)
- **Lucide React** (consistent iconography)
- **Browser Local State** (React Context + `localStorage` persistence)

---

## 3. Implemented Pages & Features

### A. Persistent Layout Shell (`src/components/layout/`)
- **Sidebar**:
  - Dashboard (`/`)
  - Prospects (`/prospects`)
  - Call Workspace (`/workspace`)
  - Follow-ups (`/follow-ups`)
  - Call History (`/history`)
  - Settings (`/settings`)
  - Responsive mobile drawer with toggle button.
  - Active page indicator, pending badge counters, and rep profile preview.
- **TopBar**:
  - Contextual page title and breadcrumb descriptions.
  - Contextual primary actions (e.g. "+ Add Prospect", "Start Call", "+ New Follow-up").
  - Visual status pill explaining the Phase 1 local prototype state.

### B. Dashboard (`src/pages/DashboardPage.tsx`)
- **Real-time KPI Cards**:
  - Total Prospects, In Discussion & Qualified counts.
  - Calls Planned (automatically computed from uncalled accounts and scheduled call tasks).
  - Follow-ups Due (with overdue task warning).
  - Completed Calls counter.
- **Recent Call Activity**: Feed of recent discovery calls with outcomes and note snippets.
- **Upcoming Follow-ups Widget**: Interactive checkboxes to immediately complete tasks from the dashboard.
- **Recent Prospects Table**: Quick "Call" action that deep-links directly into the workspace with the selected account.
- **Empty States**: Friendly fallback layouts when records are cleared.

### C. Prospects Directory (`src/pages/ProspectsPage.tsx`)
- **Search & Filtering**: Live search by company name, contact person, or location; filterable by Industry vertical and Account status.
- **Full Account Dossier Table**: Company name, contact, job title, industry, direct phone & email, status badges, and last contact date.
- **Prospect Form Modal**: Reusable form for creating and editing accounts with client-side validation (required company name, email syntax check, website normalization).
- **Prospect Detail Drawer**: In-depth view displaying plant machinery type, employee count, notes, logged call history, and linked follow-ups.
- **Delete Confirmation**: Safe confirmation dialog to prevent accidental clicks.

### D. Call Workspace (`src/pages/CallWorkspacePage.tsx`)
- **Prospect Selector**: Select any manufacturing account or deep-link via query parameter (`?prospectId=...`).
- **Context Bar**: Instant access to company name, decision-maker, direct phone, and plant machinery summary.
- **Call Objective**: Editable call objective with quick-select presets (CNC Tooling & Uptime, Supplier Delays, Scrap & Rework).
- **Interactive Question Checklist**: Discovery questions tailored to manufacturing operations with click-to-check tracking.
- **Live Call Timer**: Stopwatch timer with Start, Pause, Resume, and End Call controls.
- **Note Taking**: Real-time manual conversation notes with quick tag shortcuts.
- **Business Problem Extractor**: Dedicated field to capture stated operational pains (spindle downtime, scrap percentage, supplier delays).
- **Outcome & Follow-up Scheduling**: Select call outcome, define next action, and pick a follow-up target date. Automatically creates a linked task upon logging!

### E. Follow-ups Board (`src/pages/FollowUpsPage.tsx`)
- **Task Management**: Track post-call quotes, CAD drawings, and scheduled callbacks.
- **Status Tabs**: Fast switching between All, Pending, Overdue, and Completed tasks.
- **Interactive Toggles**: One-click completion with strikethrough styling and completed timestamp.
- **Priority Badges**: High, Medium, and Low visual indicators.
- **Add & Edit Modal**: Create or update follow-up tasks with client-side validation.

### F. Call History (`src/pages/CallHistoryPage.tsx`)
- **Historical Call Log**: Displays prospect name, call date, duration, outcome, and notes preview.
- **Filtering & Search**: Search across call notes, objectives, or companies; filter by Call Outcome.
- **Call Log Detail Modal**: Complete review of the conversation notes, stated business problems, and scheduled next steps.

### G. Settings & Prototype Roadmap (`src/pages/SettingsPage.tsx`)
- **Sales Rep Profile**: Current user profile and sales territory display.
- **Preferences**: Customizable default call objectives and stopwatch timer toggle.
- **Architecture Notice Card**: Explicitly details the deferred Phase 2 (Auth) and Phase 3 (Supabase + LLM Reasoning) roadmap.
- **Reset Prototype Data**: Restores initial demonstration manufacturing records at any time.

---

## 4. Project Structure

```
d:/Downloads/Assignment_Cold_Call_copilot/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   └── index.ts               # Core domain interfaces
│   ├── data/
│   │   └── mockData.ts            # Isolated manufacturing sample records
│   ├── context/
│   │   └── DataContext.tsx        # React Context + LocalStorage persistence
│   ├── components/
│   │   ├── common/
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── prospects/
│   │   │   ├── ProspectFormModal.tsx
│   │   │   └── ProspectDetailDrawer.tsx
│   │   └── followups/
│   │       └── FollowUpModal.tsx
│   └── pages/
│       ├── DashboardPage.tsx
│       ├── ProspectsPage.tsx
│       ├── CallWorkspacePage.tsx
│       ├── FollowUpsPage.tsx
│       ├── CallHistoryPage.tsx
│       ├── SettingsPage.tsx
│       └── NotFoundPage.tsx
```

---

## 5. How to Run and Verify Locally

### Prerequisites
- Node.js 18+ (tested on Node v20.19.4)
- npm 10+

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/) in your web browser.

### Type Check & Production Build
```bash
npm run build
```
The build executes `tsc` (TypeScript compiler) followed by `vite build`. Both complete with **0 errors**.

---

## 6. Vercel Deployment & Environment Variables

This application is fully pre-configured for one-click deployment on **Vercel** with SPA rewrites (`vercel.json`) and TypeScript compilation.

### Step 1: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com/) and click **Add New Project**.
2. Import the GitHub repository: `amixsites/cold-call-copilot`.
3. Framework Preset: **Vite** (auto-detected).
4. Build Command: `npm run build` (auto-detected).
5. Output Directory: `dist` (auto-detected).

### Step 2: Configure Environment Variables
Under **Settings → Environment Variables** in the Vercel dashboard, add the following variables:

| Variable Name | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://rduxyhkwgykejczxircd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon / Public API Key | `eyJhbGciOiJIUzI1NiIsIn...` |
| `VITE_API_BASE_URL` | Express backend URL (Render, Railway, Fly.io, VPS) | `https://your-backend.railway.app` |

### Step 3: Deploy
Click **Deploy**. Vercel will compile the TypeScript application, optimize assets, and deploy the application to your live `.vercel.app` URL.
