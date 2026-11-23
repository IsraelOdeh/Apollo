# NeuroEdge

**Offline-first scalp EEG seizure triage support and interactive 10-20 neurophysiology workstation**, built for the NeuralVillage Neurotech Hackathon (NMC Kwali).

NeuroEdge runs end-to-end EDF/EDF+ signal parsing, digital signal processing (DSP), 3-layer MLP seizure inference, and 3D cortical mapping **100% locally in the browser** via IndexedDB—with zero outbound raw EEG traffic.

---

## Intended Use & Operational Boundaries

- **Intended use:** Offline-first scalp EEG seizure triage support and interactive 10-20 neurophysiology education using locally loaded EDF/EDF+ recordings.
- **Excluded uses:**
  - Autonomous epilepsy diagnosis or ruling out neurological disorders.
  - Medication dosing, emergency intervention, or unsupervised clinical deployment.
  - Continuous background monitoring or passive student/workplace surveillance.
- **Human authority:** Every model candidate remains `Pending` until a named reviewer confirms or rejects it. Reviewers can override any flag, adjust operating thresholds, or purge local session data at any time.

---

## Core Capabilities

- **On-Device EDF/EDF+ Inspection (`EEG Workspace`):** Import standard `.edf` / `.edf+` files locally via `edfcore` with display-only High-pass, Low-pass, and Notch filtering, montage selection, amplitude gain, and timeline scrubbing without modifying source recordings.
- **28-Feature Browser-Native Screening (`lib/eeg/edge-screening.ts`):** Resamples scalp channels to 256 Hz, applies zero-phase biquad filtering (0.5–45 Hz bandpass, 50 Hz notch) and Common Average Reference (CAR) for referential montages, extracts 28 channel-agnostic features per 2-second (512-sample) window, and runs a ~55 KB JSON MLP (`edge_model.json`) with a 5-window trailing mean smoother.
- **Explicit Abstention Gate:** Rather than forcing a binary Seizure / Non-Seizure label on corrupted traces, the pipeline outputs an explicit **`Inconclusive / Abstain`** state (`abstain_unreliable`) on flatlined/disconnected leads, severe saturation (>450 µV with ocular interference), or noisy borderline segments, and uses calibrated confidence tiers instead of false-precision decimals.
- **Interactive 3D Cortical & 10-20 Viewer (`BrainViewer`):** Theme-adaptive Three.js cortical model mapping uploaded EDF channels and detected events onto standard 10-20 electrodes with inline expandable waveform sparklines, RMS microvolt readouts, and anatomical/seizure semiology guides.
- **Role-Scoped Views (`Clinical` vs. `Education`):**
  - **Clinical view:** Full multichannel workspace, triage timelines, recording library, repository, and exportable reports.
  - **Education view:** Hides raw clinical waveforms, unreviewed triage queues, and export tables—focusing on the 3D cortical explorer, EEG frequency band guides, 10-20 electrode naming, and caregiver safety references.
- **Adaptive Interface:** Working Light, Dark, and System themes, collapsible navigation sidebar, and PWA offline support.

---

## Privacy by Design & Data Flow (NDPA 2023 / NDPC 2025)

```text
Local EDF File  ->  Browser DSP (28 features)  ->  Local MLP + Abstain Gate  ->  Clinician Review
```

- **Local-only by default:** All raw EDF blobs, derived DSP features, screening sessions, and review annotations stay inside browser IndexedDB (`NeuroEdgeDB`). Cloud synchronization and optional research metadata reuse are **OFF by default** with zero feature penalty when declined.
- **Verifiable zero-upload execution:** Open browser DevTools → **Network** tab while uploading and screening an `.edf` file to verify zero raw EEG bytes leave the workstation.
- **One-click erasure:** Purge an active recording from `AI Screening` or wipe all local recordings, events, annotations, and reports from `Settings → Local storage & purge`.
- **Pre-export artefact inspection:** Before generating any CSV or PDF summary in `Reports`, NeuroEdge displays an explicit breakdown of included pseudonymous fields vs. excluded raw waveforms and identifiers, noting that derived EEG outputs retain a traceable neural origin.

---

## Model & Feature Specification (`lib/eeg/edge_model.json`)

| Parameter | Specification |
| :--- | :--- |
| **Architecture** | 3-layer MLP (`mlp-v1`): 28 inputs → 32 (ReLU) → 16 (ReLU) → 2 (Softmax) |
| **Artifact Footprint** | ~55 KB pure JSON (zero external ML runtime dependencies) |
| **Epoching & Smoothing** | 2.0 s windows (512 samples @ 256 Hz), 5-window trailing average |
| **Per-Channel Features (Max & Mean = 24)** | Line Length, RMS, log-TKEO, Hjorth Activity / Mobility / Complexity, Shannon Spectral Entropy (0.5–40 Hz), 5-level Daubechies-4 DWT relative power (Delta, Theta, Alpha, Beta, Gamma) |
| **Spatial & Artifact Features (4)** | Focal Crest Ratio, Channel Recruitment %, Frontal-to-Posterior Blink Ratio, Hemispheric Asymmetry |
| **Threshold Presets** | High sensitivity (`0.54`, FPR 0.05) · Balanced (`0.69`, FPR 0.02) · Low alerts (`0.77`, FPR 0.01) · Very low alerts (`0.83`, FPR 0.005) |

### Evaluation & Unresolved Gaps Before Clinical Use
- **Evaluation:** Trained and cross-patient validated on public scalp EEG benchmarks (adult Siena Scalp EEG and pediatric CHB-MIT cohorts) using held-out subjects.
- **Gaps to resolve before clinical deployment:**
  1. Institutional ethics / IRB review (separate from participant consent and NDPA 2023 lawful basis).
  2. Prospective clinical validation on local Nigerian patient cohorts and hardware setups.
  3. Field testing across practical barriers including diverse hair textures and electrode contact impedance, local languages, and intermittent power/connectivity.
  4. Change-review and threshold recalibration whenever acquisition hardware, montage, or clinical workflow changes.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **3D Visualization:** Three.js, React Three Fiber, Drei
- **EEG & Local Storage:** `edfcore`, Dexie (IndexedDB), Recharts, Serwist PWA

---

## Project Structure

```text
app/
├── page.tsx                         # Role-aware Overview (Clinical telemetry / Education hub)
├── workspace/page.tsx               # Multichannel EDF waveform viewer & DSP controls
├── screening/page.tsx               # Triage timeline, abstain flags & clinician review
├── recordings/page.tsx              # Local EDF recordings library
├── repository/page.tsx              # Standardized telemetry repository
├── reports/page.tsx                 # Analytics, audit trail & pre-export privacy check
├── model/page.tsx                   # Unified Model Card, Data Flow Map & Intended Use
└── settings/page.tsx                # Theme, role, threshold presets, privacy & local purge

components/
├── brain/                           # 3D cortical model, shaders & inline event trace viewer
├── layout/                          # Vector NeuroEdge logo, collapsible sidebar & top bar
└── neuroedge/                       # Workspace, screening, reports, model card & settings UI

lib/
├── eeg/
│   ├── edge_model.json              # Trained MLP weights, normalization stats & presets
│   ├── edge-screening.ts            # Filters, 28-feature DSP, MLP forward pass & abstain gate
│   └── brain-bridge.ts              # 10-20 channel normalization & neurophysiology guides
├── privacy/
│   └── workstation-policy.ts        # Local-only defaults, role policy, calibration & DB purge
└── storage/
    └── db.ts                        # Dexie IndexedDB schema (NeuroEdgeDB)
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Verify TypeScript & production build
npm run typecheck
npm run build
```

Open `http://localhost:3000` in your browser.