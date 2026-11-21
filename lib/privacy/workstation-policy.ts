// lib/privacy/workstation-policy.ts
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/storage/db";
import rawModelData from "@/lib/eeg/edge_model.json";
const DEFAULT_THRESHOLD = rawModelData.threshold ?? 0.6902169685778347;

export type ViewRole = "clinician" | "education";

export interface WorkstationPolicy {
  /** Active display role: controls which outputs are visible on screen. */
  role: ViewRole;
  /** Name recorded on human review annotations and audit logs. */
  reviewerName: string;
  /** Enforces local-only browser execution; blocks any optional outbound sync. */
  localOnlyMode: boolean;
  /** Optional research metadata reuse flag; always OFF by default with zero penalty when declined. */
  allowResearchExport: boolean;
  /** Active operating threshold selected from edge_model.json presets. */
  operatingThreshold: number;
  /** Human-readable preset label synced with operatingThreshold. */
  thresholdLabel: string;
}

const POLICY_STORAGE_KEY = "ne_workstation_policy_v1";
const POLICY_EVENT = "ne-policy-change";


export const DEFAULT_WORKSTATION_POLICY: WorkstationPolicy = {
  role: "clinician",
  reviewerName: "Research Operator",
  localOnlyMode: true,
  allowResearchExport: false,
  operatingThreshold: DEFAULT_THRESHOLD,
  thresholdLabel: "Balanced (0.69)",
};

/**
 * Single source of truth for Intended Use, Excluded Uses, Limitations, and Accountability.
 * Rendered on the Model Information page and mirrored verbatim in README.md.
 */
export const INTENDED_USE_SPEC = {
  intendedUse:
    "Offline-first scalp EEG seizure triage support and interactive 10-20 neurophysiology education using locally loaded EDF/EDF+ recordings.",
  excludedUses: [
    "Autonomous epilepsy diagnosis or ruling out neurological disorders.",
    "Medication dosing, emergency intervention, or unsupervised clinical deployment.",
    "Continuous background monitoring or passive student/workplace surveillance.",
  ],
  evaluationSummary: [
    "Trained and cross-patient validated on public scalp EEG benchmarks (adult Siena Scalp EEG and pediatric CHB-MIT cohorts).",
    "Evaluated on held-out subjects using 28 channel-agnostic DSP features (Daubechies-4 DWT, Hjorth parameters, Teager-Kaiser energy, spectral entropy, and frontal-to-posterior blink ratio) with a 5-window trailing mean smoother.",
    "Explicit abstention path triggers on flatlined/disconnected leads, severe saturation (>450 µV), ocular blink corruption, or low-quality borderline segments rather than forcing a binary label.",
  ],
  knownGapsBeforeClinicalUse: [
    "Requires institutional ethics / IRB approval separate from participant consent and Nigeria Data Protection Act (NDPA 2023) lawful basis.",
    "Requires prospective validation on local Nigerian clinical cohorts and hardware setups.",
    "Must test real-world practical barriers including diverse hair textures and electrode contact impedance, local languages, and intermittent facility power/connectivity.",
  ],
  accountability: {
    humanAuthority:
      "Every model candidate remains Pending until a named reviewer confirms or rejects it. Reviewers can override any flag or purge local session data at any time.",
    changeReviewTriggers:
      "Re-evaluation and threshold recalibration are required before changing the acquisition headset, electrode montage, target population, or clinical workflow.",
  },
} as const;

/**
 * Reads the persisted workstation policy synchronously (safe on SSR).
 */
export function getWorkstationPolicy(): WorkstationPolicy {
  if (typeof window === "undefined") return DEFAULT_WORKSTATION_POLICY;
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSTATION_POLICY;
    const parsed = JSON.parse(raw) as Partial<WorkstationPolicy>;
    return {
      ...DEFAULT_WORKSTATION_POLICY,
      ...parsed,
    };
  } catch {
    return DEFAULT_WORKSTATION_POLICY;
  }
}

/**
 * Persists partial policy updates and broadcasts to all mounted components.
 */
export function updateWorkstationPolicy(
  patch: Partial<WorkstationPolicy>,
): WorkstationPolicy {
  const next = { ...getWorkstationPolicy(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(POLICY_EVENT, { detail: next }));
  }
  return next;
}

/**
 * React hook subscribed to live workstation policy changes across pages.
 */
export function useWorkstationPolicy() {
  const [policy, setPolicy] = useState<WorkstationPolicy>(
    DEFAULT_WORKSTATION_POLICY,
  );

  useEffect(() => {
    setPolicy(getWorkstationPolicy());

    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<WorkstationPolicy>).detail;
      if (detail) setPolicy(detail);
    };

    window.addEventListener(POLICY_EVENT, onUpdate);
    return () => window.removeEventListener(POLICY_EVENT, onUpdate);
  }, []);

  const setPolicyPatch = (patch: Partial<WorkstationPolicy>) => {
    const updated = updateWorkstationPolicy(patch);
    setPolicy(updated);
  };

  return { policy, updatePolicy: setPolicyPatch };
}

/**
 * Converts a raw MLP confidence score into calibrated categories to avoid false precision.
 */
export function formatCalibratedConfidence(
  eventType: string,
  score: number,
  threshold: number = DEFAULT_THRESHOLD,
): { label: string; detail: string } {
  if (eventType === "abstain_unreliable") {
    return {
      label: "Abstained",
      detail: "Unreliable signal — manual waveform review required",
    };
  }
  if (eventType === "artifact") {
    return {
      label: "Artifact gated",
      detail: "High ocular/EMG energy detected",
    };
  }
  if (score >= Math.min(0.95, threshold + 0.14)) {
    return {
      label: "High-confidence candidate",
      detail: "Strong rhythmic/energy shift above operating threshold",
    };
  }
  if (score >= threshold) {
    return {
      label: "Moderate candidate",
      detail: "Above threshold — verify morphology on raw trace",
    };
  }
  return {
    label: "Borderline — verify",
    detail: "Near decision boundary — inspect adjacent channels",
  };
}

/**
 * Permanently erases a single EDF recording and all derived sessions, events, annotations, and reports.
 */
export async function purgeSingleRecording(recordingId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.recordings,
      db.screening_sessions,
      db.detected_events,
      db.annotations,
      db.reports,
      db.sync_queue,
    ],
    async () => {
      const sessions = await db.screening_sessions
        .where("recording_id")
        .equals(recordingId)
        .toArray();

      for (const s of sessions) {
        await db.detected_events.where("session_id").equals(s.id).delete();
        await db.annotations.where("session_id").equals(s.id).delete();
        await db.reports.where("session_id").equals(s.id).delete();
      }

      await db.screening_sessions
        .where("recording_id")
        .equals(recordingId)
        .delete();
      await db.recordings.delete(recordingId);
      await db.sync_queue.where("entity_id").equals(recordingId).delete();
    },
  );

  if (typeof window !== "undefined") {
    const active = localStorage.getItem("ne_active_recording_id");
    if (active === recordingId) {
      localStorage.removeItem("ne_active_recording_id");
    }
  }
}

/**
 * Permanently wipes all local recordings, screening sessions, events, annotations, reports, and queued sync items.
 */
export async function purgeAllLocalNeuroData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.recordings,
      db.screening_sessions,
      db.detected_events,
      db.annotations,
      db.reports,
      db.sync_queue,
    ],
    async () => {
      await Promise.all([
        db.recordings.clear(),
        db.screening_sessions.clear(),
        db.detected_events.clear(),
        db.annotations.clear(),
        db.reports.clear(),
        db.sync_queue.clear(),
      ]);
    },
  );

  if (typeof window !== "undefined") {
    localStorage.removeItem("ne_active_recording_id");
  }
}