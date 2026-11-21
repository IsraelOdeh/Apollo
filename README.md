# NeuroEdge

Offline-first scalp EEG seizure triage support and interactive 10-20 neurophysiology workstation built for the NeuralVillage Neurotech Hackathon (NMC Kwali).

## Intended Use
- **What NeuroEdge is for:** Offline-first scalp EEG seizure triage support and interactive 10-20 neurophysiology education using locally loaded EDF/EDF+ recordings.
- **Excluded uses:** Not intended for autonomous epilepsy diagnosis, ruling out neurological disorders, medication or treatment decisions, unsupervised clinical deployment, or passive student/workplace surveillance.

## Privacy by Design & Data Flow (NDPA 2023 / NDPC 2025)
```text
Local EDF File  ->  Browser DSP (28 features)  ->  Local MLP + Abstain Gate  ->  Human Clinician Review