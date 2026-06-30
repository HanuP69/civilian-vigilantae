# Sentinel Civic — Community Hero

**Hyperlocal civic issue reporting, verification, and resolution, run by a multi-agent AI system.**

Sentinel Civic lets citizens of Lucknow report potholes, water leaks, streetlight failures, waste, road damage, and drainage issues with a photo/video and a pin on the map. From there, a chain of cooperating AI agents — not a single prompt — classifies the issue, deduplicates it against existing reports, scores its trustworthiness, prioritizes it, forecasts whether it will breach its resolution SLA, drafts a dispatch plan, diagnoses root cause, and notifies the community in real time. Citizens earn XP, gold, and leaderboard rank for reporting and verifying issues, turning civic participation into a gamified loop.

Built solo for the **OmniBoard / Community Hero hackathon** (Problem Statement: Hyperlocal Problem Solver).

---

## 1. Problem

Civic issue reporting in Indian cities is fragmented: complaints go to disconnected department helplines, duplicates flood the system, there's no transparency on what's actually being done, and there's no way to tell which issues are urgent versus noise. Sentinel Civic fixes this with a single pipeline that ingests a report, reasons about it, and routes it correctly — automatically.

## 2. System Architecture

```
React/Vite Client  ──HTTP/SSE──▶  Express API  ──▶  Agent Orchestrator  ──▶  Firestore
   (Leaflet map,                  (auth, routes,        (multi-agent          (NoSQL,
    SSE live feed,                 rate limit)            pipeline +            transactional)
    RPG dashboard)                                        ReAct loop)
                                                                │
                                                                ▼
                                                   Gemini API / Ollama (local LLM)
                                                   (2 independent Gemini calls
                                                    fused for classification)
```

- **Client**: React 19 + Vite, Leaflet/react-leaflet maps, Chart.js dashboards, Firebase JS SDK for auth/storage, Framer Motion for the pixel-art "Community Hero" RPG layer (quests, XP, sprites).
- **Server**: Node.js/Express 5, organized as `routes → agent orchestrator → math modules → Firestore`, with Server-Sent Events for live ticket/agent-trace streaming.
- **Database**: Firebase Firestore (with an in-memory mock Firestore for local dev without credentials — same query surface: `where`, transactions, `get/set/update/delete`).
- **AI**: Google Gemini (`@google/generative-ai`, model `gemini-2.5-flash`) as the LLM for everything — multimodal classification, the ReAct tool-calling agent loop, dispatch planning, and root-cause synthesis — with a pluggable `LLMClient` interface that swaps in **Ollama** (local, e.g. `qwen2.5:7b-instruct`) for offline/cost-free operation, selected via `LLM_BACKEND` env var with zero code change elsewhere.
- **Independent second-opinion classification**: rather than calling out to a separate Google Cloud Vision API, the system makes a *second, independent* Gemini 2.5 Flash call per report — one pass sees the citizen's text + media (the "primary" classifier), the other sees the media only, with text deliberately withheld (the "visual auditor"). Their outputs are fused with the same Bayesian consensus math a Gemini+Vision pipeline would use (see §4.5), without adding a second GCP API dependency.
- **Deployment**: Multi-stage Docker build (client `vite build` → static assets served by Express) targeting Cloud Run.

## 3. The Agentic Pipeline

Every report is processed by an **agent chain communicating over an in-memory message bus**, not a single LLM call. Each agent logs its reasoning to a trace that's streamed to the client UI live (`AgentTrace.jsx`), so the user watches the AI think.

| Agent | Responsibility |
|---|---|
| **ReportIntakeAgent** | Validates report is inside the Lucknow bounding box, then runs a genuine **ReAct (Reason+Act) loop**: the LLM is given 5 tools (`classify_issue`, `geo_resolve`, `find_cluster`, `query_ward_historical_stats`, `audit_ticket_details`) and *autonomously decides* which to call, in what order, up to 6 iterations, before emitting a routing decision (`create_ticket` / `merge_duplicate` / `needs_review`). Falls back to a deterministic classify→geo sequence if the LLM is unreachable. |
| **ClusteringAgent** *(orchestrator-inlined)* | Runs DBSCAN with a composite spatial+temporal+category distance metric to find duplicate reports (§4.1). |
| **VerificationAgent** *(orchestrator-inlined)* | Computes a Bayesian log-odds trust/verification score from AI confidence, reporter trust, spatial evidence density, and community votes (§4.3). Also queries **agent memory** — historical ward dispute ratios — to penalize reporter trust in wards with a track record of disputed reports. |
| **PriorityAgent** | Computes a weighted 0–100 priority score across severity, report volume, verification ratio, SLA urgency, and a dynamic safety-risk matrix (§4.2). |
| **SLAAgent** | Runs a Weibull survival-analysis model fitted via Maximum Likelihood Estimation (Newton–Raphson) to forecast breach probability (§4.4). |
| **PlannerAgent** | LLM-driven dispatch planner: prompts Gemini/Ollama to output department, crew size, materials, ETA, and estimated cost as structured JSON, with a deterministic rule-based fallback plan if the LLM call fails or returns malformed JSON. |
| **GovernanceAgent** | Sends real-time SSE notifications to watching citizens and escalates tickets whose SLA-breach probability crosses 80%. |

Agents pass typed messages to each other via an `AgentMessageBus` (`{from, to, type, payload}`), all captured in the trace. A separate **`processSchedulerTick`** loop runs every 5 minutes via `setInterval` (the local analogue of **Cloud Scheduler**), re-evaluating every open ticket's SLA risk and priority, auto-escalating breaches, and cleaning up expired demo accounts.

**Root Cause Diagnosis**: after every ticket create/merge, `rootCauseService.analyzeRootCause` computes cluster composition, temporal correlation (standard deviation of report timestamps) **and burstiness index** (`(σ−μ)/(σ+μ)` of inter-arrival intervals — a Fano-factor-style measure of clustering vs. regular spacing), asset correlation, and historical recurrence risk, then asks the LLM to synthesize a one-line probable cause (e.g. "Aging Water Main Leakage") grounded strictly in that numeric evidence, with a confidence score derived from the evidence itself (not the LLM).

## 4. The Math

All of the following are implemented from scratch in `server/src/math/` with full unit test coverage (`__tests__/`).

### 4.1 — Composite-Distance DBSCAN (`dbscan.js`)
Standard DBSCAN, but the distance function blends three normalized signals so geographically close, temporally recent, *and* categorically related reports cluster together:

```
d(p1, p2) = α·d_spatial + β·d_temporal + γ·d_category      (α=0.40, β=0.35, γ=0.25)
```

- `d_spatial` — Haversine great-circle distance, normalized over a 500 m ceiling.
- `d_temporal` — absolute time delta, normalized over a **category-adaptive window** (24h for potholes/waste, 48h for water leaks/road damage/drainage, 72h for streetlight/other — different issue types "go stale" at different rates).
- `d_category` — `1 − similarity`, where similarity comes from a hand-tuned semantic matrix (e.g. pothole↔road_damage = 0.8, drainage↔waste = 0.4) rather than treating categories as strictly equal/unequal.

Within a found cluster, candidates are additionally gated by exact Haversine proximity (≤100 m) and **Jaccard text similarity** (≥0.25) on report descriptions before being accepted as true duplicates — clustering proposes, text+distance confirm.

### 4.2 — Dynamic Priority Score (`priority.js`)
```
P = 0.20·S_severity + 0.25·log(1+N)/log(100) + 0.20·V_ratio + 0.20·SLA_ratio + 0.15·R_safety   → scaled to [0,100]
```
`R_safety` is not a static per-category constant — it's a **dynamic risk matrix**: base category risk (0.3–0.8) + a night-time multiplier (+0.4 for electrical/streetlight issues reported between 6pm–6am) + a keyword-boost scan over the report description (`wire`, `shock`, `flood`, `cave-in`, `open manhole`, etc.), clamped and bucketed into discrete risk tiers.

### 4.3 — Bayesian Verification Score (log-odds fusion) (`verification.js`)
Verification combines four independent evidence sources via **exact Bayesian updating in log-odds space**, not a naive weighted average:

```
L_final = wAi·logit(AI_confidence) + wTrust·logit(reporter_trust) + wNearby·logit(spatial_evidence) + wVotes·logit(community_votes)
score   = sigmoid(L_final) × 100
```
Spatial evidence itself uses an exponential decay kernel `Σ e^(−dᵢ/100)` over nearby report distances. The system ships **A/B-testable weight configurations** (`control`/`variantA`/`variantB`) selectable via env var, letting the verification model's evidence weighting be tuned without redeploying logic. Status thresholds: ≥70 verified, ≥40 reported, ≥20 needs_review, else disputed.

### 4.4 — Weibull Survival Analysis for SLA & Recurrence (`weibull.js`, `recurrence.js`)
SLA breach probability is modeled with the Weibull distribution (`λ` scale, `k` shape), with parameters **fitted from real historical resolution times via Maximum Likelihood Estimation using Newton–Raphson iteration** on the profile log-likelihood (closed-form λ once k converges), falling back to empirically-tuned per-category defaults when too little data exists:
```
F(t) = 1 − exp(−(t/λ)^k)
P(breach by t1 | survived to t0) = 1 − exp((t0/λ)^k − (t1/λ)^k)
```
The same machinery powers **recurrence-risk forecasting**: inter-arrival intervals between resolved tickets in a (ward, category) group are MLE-fitted, then the base Weibull forecast probability is adjusted by three causal multipliers — Lucknow seasonal/monsoon weighting (drainage/pothole risk rises Jul–Sep), repair-quality feedback (low average verification score on past resolutions → higher recurrence risk), and recent "swarm growth rate" (fast inter-arrival velocity → +25% risk).

### 4.5 — Bayesian Consensus Fusion for Classification (`classificationService.js`)
Two **independent Gemini 2.5 Flash calls** are fused into a posterior distribution over the 7 issue categories: the **primary classifier** sees the citizen's text + media (treated as the prior), and a separate **visual-audit classifier** sees *only* the media — the text is deliberately withheld so it forms a genuinely independent second opinion (treated as the likelihood), playing the same statistical role a Google Cloud Vision label-detection call used to. The system reports **Shannon entropy** of that posterior as an uncertainty signal — high-entropy classifications (the two opinions disagree) are flagged `uncertain_classification` for human review instead of being silently trusted. If the visual-audit call fails or there's no media, the likelihood collapses to uniform and the posterior gracefully degrades to single-model classification.

### 4.6 — Other math
- **Accuracy module**: Brier score for SLA-forecast calibration, classification accuracy for consensus-vs-ground-truth auditing.
- **Ward health score**: `100 − (avgPriority·0.5 + activeCount·2 + verifiedCount·1.5 + recurrenceCount·2)`.

## 5. Database & Transactional Integrity

Firestore (or the bundled in-memory mock for credential-free local dev) stores `tickets`, `users`, `assets`, and `missions` collections. The core create-or-merge decision — read all recent tickets, DBSCAN them against the incoming report, decide duplicate vs. new, recompute weighted community votes and verification score, write — happens **inside a single Firestore transaction** (`db.runTransaction`) so concurrent reports never race into duplicate tickets or lost vote updates.

## 6. Auth & Security Hardening

- Bearer-token auth middleware (`requireAuth`) gates write routes; token doubles as user ID for the hackathon scope.
- `express-rate-limit` on report-submission and LLM-touching endpoints to control cost and abuse.
- Request bodies capped at 10MB; uploaded media capped at 25MB with strict MIME/extension allowlisting (`mediaUploadService.js`).
- All outbound LLM calls wrapped in `retryWithBackoff` (exponential backoff, 3 attempts) so a transient Gemini/Ollama timeout never crashes a report submission — pipeline always degrades to deterministic fallbacks (rule-based classification, rule-based dispatch plan) rather than failing the request.
- Dependency audit pass done pre-demo across both `client` and `server` package trees.

## 7. Google Technologies Used

| Technology | Usage |
|---|---|
| **Gemini API** (`gemini-2.5-flash`) | Multimodal issue classification (run as two independent calls fused via Bayesian consensus), ReAct tool-calling agent reasoning, dispatch planning, root-cause synthesis |
| **Firebase Firestore** | Primary transactional NoSQL datastore |
| **Firebase Storage** | Citizen-uploaded photo/video evidence storage |
| **Firebase Auth (client SDK)** | Citizen identity |
| **Google Cloud Run** | Containerized deployment target (Dockerfile multi-stage build) |
| **Google Maps Platform / Leaflet+OSM** | Map rendering, geocoding ward resolution |
| Cloud Scheduler equivalent | `slaScheduler.js` 5-minute tick loop re-evaluates SLA risk fleet-wide (designed to map directly onto Cloud Scheduler + Cloud Run job in production) |

## 8. Gamification Layer

Citizens earn XP/gold for reports and verification votes (`userService.awardXP`), level up (`level = floor(sqrt(xp/50)) + 1`), unlock badges/avatars, and climb a ward leaderboard. A live **mission system** (`missionService.js`) surfaces hotspot-prediction and duplicate-cluster confirmation quests pulled from the same agent pipeline output.

## 9. Quick Start

### Server
```sh
cd server
npm install
npm run dev
```

### Client
```sh
cd client
npm install
npm run dev
```

### Environment Variables (`server/.env`)
```
GEMINI_API_KEY=your_key
LLM_BACKEND=gemini            # or "ollama" for local/offline
PORT=3001
CLIENT_URL=http://localhost:5173
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_STORAGE_BUCKET=...
USE_MOCK_FIRESTORE=true       # set false once Firebase creds are configured
GOOGLE_MAPS_API_KEY=...
```

### Docker / Cloud Run
```sh
docker build -t sentinel-civic .
docker run -p 8080:8080 --env-file server/.env sentinel-civic
```

## 10. Testing
```sh
cd server && npm test
```
Unit tests cover DBSCAN clustering, Weibull MLE/CDF, Haversine distance, priority scoring, verification log-odds fusion, recurrence forecasting, classification accuracy/Brier score, and the agent orchestrator/loop.

---

*Built solo for the OmniBoard hackathon — see `SUBMISSION.md` for the formatted project-description content (problem statement, solution overview, key features, technologies used) ready to paste into the submission Google Doc.*
