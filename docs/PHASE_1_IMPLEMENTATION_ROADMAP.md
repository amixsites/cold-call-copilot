# Phase 1: Implementation Roadmap & Execution Plan (Phases 2–5)
**Cold Call Copilot | DeepThought CultureTech Ventures**  
**Roadmap Scope:** Four-Phase Structured Delivery (Phases 2 to 5)  
**Date:** October 2026  

---

## 1. Roadmap Overview & Phasing Strategy

This roadmap details the sequential engineering execution plan to complete the Cold Call Copilot platform in accordance with the official specification (`Cold_Call_Copilot_Technical_Specification.docx`). Each phase has clear entry prerequisites, concrete deliverables, testing criteria, and explicit risk mitigation strategies.

```mermaid
gantt
    title Cold Call Copilot Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1
    Repository Audit & Foundation :done, p1, 2026-10-26, 1d
    section Phase 2
    8-Stage Live-Call Workspace    :active, p2, 2026-10-27, 2d
    section Phase 3
    Backend & Additive Database    :p3, after p2, 2d
    section Phase 4
    Call History, AI & Analytics   :p4, after p3, 2d
    section Phase 5
    Testing, Deployment & Delivery :p5, after p4, 2d
```

---

## 2. Phase 2: Eight-Stage Live-Call Workspace

### 2.1 Objective
Transform the live-call interface (`src/pages/CallWorkspacePage.tsx`) from a static 5-note form into an authentic, fast-paced 8-stage cold-call copilot with stage progression, action taps, transcript-backed prompts, verbatim quote capture, and universal early termination.

### 2.2 Key Deliverables & Features
1. **Eight-Stage Stepper & Navigation:**
   - Visual progress stepper displaying stages 1 through 8:
     - 1. Opening
     - 2. Purpose
     - 3. Permission
     - 4. Their business
     - 5. Their need in their words
     - 6. Objection
     - 7. Next step
     - 8. Close
   - Visual indication of current stage (`active_stage`) and completed/furthest stages.
   - Next Stage button that explicitly shows target stage name (e.g., *"Next: Stage 3 — Permission"*).
2. **Stage-Specific Action Taps (Low Friction):**
   - Clickable pill buttons to register stage events in <0.5 seconds without typing:
     - *Stage 1:* Right person, Gatekeeper/Reception, Wrong number, Former contact, Referral/Redirect.
     - *Stage 2:* Asked what we do, Asked why calling, Asked contact source, Sales suspicion, Purpose understood.
     - *Stage 3:* Permission granted, Permission denied, Busy / Callback requested, Not available.
     - *Stage 4:* Context shared, Role corrected, Current process described, Decision maker elsewhere.
     - *Stage 5:* Need stated, Goal stated, No need stated, Unclear.
     - *Stage 6:* 9-category objection taxonomy buttons.
     - *Stage 7:* Send report, Send email, Send WhatsApp, Schedule callback, Book meeting, Referral given.
     - *Stage 8:* Ended normally, Line dropped, Prospect ended, Caller ended.
3. **Curated Transcript Prompt Cards:**
   - 2–3 authentic caller prompts derived from `cold-call-transcripts-100/` embedded directly on each stage for instant reference.
4. **Verbatim Quote Field ("Prospect’s words"):**
   - Prominent text area in Stage 5 for capturing the prospect's exact spoken words.
   - Quote status selector: `need_stated`, `goal_stated`, `no_need_stated`, `unclear`, `not_reached`.
5. **Universal End Call Action:**
   - Red "End Call" button visible and persistent across all 8 stages.
   - Triggering early exit opens a lightweight modal to capture `ending_reason` and confirms `ending_stage` without forcing stage advancement to 8.
6. **Dirty State Protection:**
   - Browser navigation guard warning the caller if unsaved call notes exist.

### 2.3 Relevant Files
- `src/pages/CallWorkspacePage.tsx`
- `src/types/index.ts`
- `src/context/DataContext.tsx`
- `src/data/mockData.ts`
- `src/components/workspace/StageStepper.tsx` (New component)
- `src/components/workspace/StageActionTaps.tsx` (New component)
- `src/components/workspace/EndCallModal.tsx` (New component)

### 2.4 Acceptance Criteria
- Caller can advance sequentially from Stage 1 to Stage 8.
- "Next Stage" button clearly displays the destination stage number and name.
- Caller can terminate call at any stage; `ending_stage` matches the stage where "End Call" was clicked.
- Tapping action buttons records stage event items with zero UI lag.
- Free-text "Prospect’s words" field saves verbatim text.

---

## 3. Phase 3: Backend, Database & Call Lifecycle Persistence

### 3.1 Objective
Implement secure PostgreSQL schema additions, create the `call_stage_events` table, update Express backend REST endpoints, and wire the live frontend to persistent cloud storage via authenticated APIs.

### 3.2 Key Deliverables & Features
1. **Safe Additive Migration (`supabase/migrations/20261027_eight_stage_call_schema.sql`):**
   - Additive columns to `public.calls`:
     - `active_stage` (`int default 1`)
     - `furthest_stage_reached` (`int default 1`)
     - `ending_stage` (`int`)
     - `ending_reason` (`varchar(50)`)
     - `outcome_code` (`varchar(50)`)
     - `prospect_words` (`text`)
     - `quote_status` (`varchar(30)`)
     - `stage_notes` (`jsonb`)
   - Create table `public.call_stage_events` with foreign keys to `calls` and `users`.
   - Implement strict Row Level Security (RLS) policies on `call_stage_events` (`using (user_id = auth.uid())`).
   - Create performance indexes on `call_id` and `stage_number`.
2. **Backend Express API Enhancements:**
   - Update `server/src/routes/calls.ts`:
     - Validate 8-stage lifecycle fields on POST and PUT.
     - Support batch saving of stage events (`/api/calls/:id/events`).
     - Enforce non-decreasing rule for `furthest_stage_reached`.
     - Reject client-supplied `user_id` and enforce `req.user.id`.
3. **Frontend API Client Integration:**
   - Wire `DataContext.tsx` to communicate with the Express API using verified Supabase bearer tokens.
   - Implement optimistic local caching with automatic background synchronization.

### 3.3 Relevant Files
- `supabase/migrations/20261027_eight_stage_call_schema.sql` (New migration)
- `server/src/routes/calls.ts`
- `src/lib/api.ts`
- `src/context/DataContext.tsx`
- `src/types/index.ts`

### 3.4 Acceptance Criteria
- Database migration executes without deleting or altering pre-existing records.
- Saving a call stores `active_stage`, `furthest_stage_reached`, `ending_stage`, `ending_reason`, and `prospect_words`.
- RLS blocks cross-user read/write attempts; verified via automated tests.

---

## 4. Phase 4: Call History, Follow-Ups & AI Post-Call Review

### 4.1 Objective
Modernize Call History and Call Details inspection, complete the follow-up and callback scheduling workflow, build honest 8-stage funnel analytics, and implement the optional server-side AI review pipeline.

### 4.2 Key Deliverables & Features
1. **Call History & Inspection Modal (`src/pages/CallHistoryPage.tsx`):**
   - Table view showing call date, prospect, duration, furthest stage badge (e.g., "Stage 5 / 8"), ending stage, ending reason, outcome badge, and quote preview.
   - Detailed call modal with full 8-stage event log timeline and verbatim quote display.
2. **Follow-Up & Callback Integration:**
   - Automatic generation of follow-up task when a call ends with `callback_requested` or `send_report`.
   - Sync with `FollowUpsPage.tsx` to mark tasks complete or reschedule.
3. **Honest 8-Stage Analytics (`src/pages/DashboardPage.tsx`):**
   - Conversion funnel chart showing prospect retention and drop-off across stages 1 to 8.
   - Objection distribution chart grouping recorded objections by category.
   - Average call duration grouped by ending stage.
   - **Constraint:** All metrics calculated purely from actual persisted records (zero fake stats).
4. **Server-Side AI Post-Call Review (`server/src/routes/aiReview.ts`):**
   - Express endpoint `POST /api/calls/:id/ai-review` protected by Supabase Auth.
   - Calls free-tier LLM API (Gemini or OpenAI compatible) via server-side `LLM_API_KEY`.
   - Validates quote integrity: verifies that the AI summary grounds its conclusions exclusively in the recorded prospect quote and stage events without hallucinating pain points.
   - Stores review in `call_ai_reviews` table.

### 4.3 Relevant Files
- `src/pages/CallHistoryPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/FollowUpsPage.tsx`
- `server/src/routes/aiReview.ts` (New module)
- `server/src/config/llm.ts` (New module)

### 4.4 Acceptance Criteria
- Call history reflects accurate furthest stage reached and ending reason for all logged calls.
- Funnel chart dynamically updates when new calls are saved.
- AI post-call review executes exclusively server-side; frontend contains zero LLM keys.

---

## 5. Phase 5: Testing, Deployment & Final Delivery

### 5.1 Objective
Execute complete end-to-end integration tests, verify security boundaries, configure production deployment for Vercel (Frontend) and Render (Backend), and prepare final demonstration materials.

### 5.2 Key Deliverables & Features
1. **Automated Testing Suite:**
   - End-to-end API integration tests verifying:
     - 8-stage call lifecycle state transitions.
     - Early termination handling.
     - Unauthenticated and cross-tenant access rejection (RLS).
     - Idempotent draft saving.
2. **Production Deployment Configuration:**
   - `vercel.json` with client-side SPA routing rewrites.
   - `render.yaml` or Render service configuration with environment variables and health check path (`/api/health`).
   - CORS origin verification for production Vercel domain.
3. **Verification Checklist & Operational Runbook:**
   - Verification across desktop and mobile tablet screen sizes.
   - Documentation of live deployed URLs and test credentials.

### 5.3 Relevant Files
- `server/test/lifecycle.test.ts` (New test suite)
- `vercel.json` (New configuration)
- `render.yaml` (New configuration)
- `README.md` (Updated operational runbook)

### 5.4 Acceptance Criteria
- Frontend passes production build with zero warnings or errors.
- Backend passes automated integration and security test suite.
- Live Vercel frontend connects securely to Render API and Supabase database.
