// lib/eeg/brain-bridge.ts
import {
  STANDARD_1020,
  type DetectedEvent as BrainDetectedEvent,
  type EventKind as BrainEventKind,
  type RegionKey,
} from "@/components/brain/brain-data";
import type { DetectedEvent as DbDetectedEvent } from "@/lib/storage/db";

const VALID_IDS = new Map<string, string>(
  STANDARD_1020.map((el) => [el.id.toUpperCase(), el.id])
);

const LEGACY_ALIASES: Record<string, string> = {
  T3: "T7",
  T4: "T8",
  T5: "P7",
  T6: "P8",
};

export interface ElectrodeEducation {
  role: string;
  normalRhythm: string;
  epileptiformClue: string;
}

export const REGION_EDUCATION: Record<
  RegionKey,
  {
    eegRole: string;
    seizureSemiology: string;
    keyElectrodes: string;
  }
> = {
  frontal: {
    eegRole:
      "Monitors executive networks, motor planning, and ocular artifact gating (Fp1/Fp2).",
    seizureSemiology:
      "Frontal lobe seizures often present with brief, nocturnal hypermotor activity, asymmetric tonic posturing, or rapid bilateral propagation.",
    keyElectrodes: "Fp1, Fp2, F7, F3, Fz, F4, F8",
  },
  central: {
    eegRole:
      "Captures the Rolandic sensorimotor strip (Mu rhythm, 8–13 Hz) along the central sulcus.",
    seizureSemiology:
      "Focal motor clonic twitching or contralateral somatosensory paresthesias; classic site for centrotemporal spikes.",
    keyElectrodes: "C3, Cz, C4",
  },
  temporal: {
    eegRole:
      "Primary window into limbic and lateral temporal networks; most frequent site of focal epilepsy.",
    seizureSemiology:
      "Epigastric rising aura, déjà vu, behavioral arrest, oral/manual automatisms, and rhythmic theta (4–7 Hz) ictal recruitment.",
    keyElectrodes: "T7 (T3), T8 (T4), P7 (T5), P8 (T6)",
  },
  parietal: {
    eegRole:
      "Integrates somatosensory association and spatial attention pathways.",
    seizureSemiology:
      "Contralateral sensory disturbances, vertiginous sensations, or rapid spread to sensorimotor and temporal regions.",
    keyElectrodes: "P3, Pz, P4",
  },
  occipital: {
    eegRole:
      "Records the Posterior Dominant Rhythm (Alpha 8–12 Hz, reactive to eye opening).",
    seizureSemiology:
      "Elementary visual hallucinations (colored phosphenes, ictal blindness), rapid blinking, and occipital spike-wave discharges.",
    keyElectrodes: "O1, O2",
  },
  cerebellum: {
    eegRole:
      "Subcortical motor coordination reference; not directly sampled by standard 10-20 scalp electrodes.",
    seizureSemiology:
      "Modulates motor timing and postural equilibrium alongside brainstem pathways.",
    keyElectrodes: "Sub-occipital / Reference",
  },
};

export function getElectrodeEducation(electrodeId: string): ElectrodeEducation {
  const id = electrodeId.toUpperCase();
  if (id === "FP1" || id === "FP2") {
    return {
      role: "Frontopolar scalp sensor positioned directly above the brow.",
      normalRhythm: "Low-voltage fast beta activity mixed with vertical eye-blink potentials.",
      epileptiformClue:
        "High frontal-to-posterior RMS ratio (Blink Ratio > 3.0) flags ocular blink artifacts so the classifier does not confuse blinks with frontal spikes.",
    };
  }
  if (id === "F7" || id === "F8") {
    return {
      role: "Anterior temporal / inferior frontal sensor over the Sylvian fissure.",
      normalRhythm: "Mixed theta/alpha background; sensitive to lateral eye movements.",
      epileptiformClue:
        "Frequent hotspot for anterior temporal interictal epileptiform discharges (IEDs) and early ictal theta buildup.",
    };
  }
  if (id === "T7" || id === "T8" || id === "P7" || id === "P8") {
    return {
      role: "Mid-to-posterior temporal sensor over the lateral temporal neocortex.",
      normalRhythm: "Symmetric medium-voltage theta/alpha rhythm.",
      epileptiformClue:
        "High Teager-Kaiser Energy (TKEO) and Daubechies-4 (db4) theta/alpha surge here strongly indicate temporal lobe seizure recruitment.",
    };
  }
  if (id === "C3" || id === "C4" || id === "CZ") {
    return {
      role: "Central Rolandic sensor directly over the primary motor and somatosensory cortex.",
      normalRhythm: "8–13 Hz arch-shaped Mu rhythm that attenuates with contralateral hand movement.",
      epileptiformClue:
        "Sharp centrotemporal spikes or focal rhythmic beta/alpha evolution during motor seizures.",
    };
  }
  if (id === "O1" || id === "O2") {
    return {
      role: "Occipital pole sensor over the primary visual cortex (calcarine sulcus).",
      normalRhythm: "8–12 Hz Posterior Dominant Alpha rhythm during relaxed wakefulness with eyes closed.",
      epileptiformClue:
        "Loss of posterior alpha or emergence of high-amplitude occipital paroxysms and photic-driven spikes.",
    };
  }
  return {
    role: "Dorsolateral scalp sensor in the international 10-20 montage.",
    normalRhythm: "Symmetric background activity with low hemispheric asymmetry (< 15%).",
    epileptiformClue:
      "Elevated Line Length, Hjorth Mobility/Complexity shift, and drop in Spectral Entropy during synchronous discharges.",
  };
}

/**
 * Resolves a raw EDF channel label (e.g. "FP1-F7", "EEG T3-Ref", "C3")
 * into one or more matching STANDARD_1020 electrode IDs (e.g. ["Fp1", "F7"]).
 */
export function resolveStandard1020Channels(rawLabel: string): string[] {
  const cleaned = String(rawLabel || "")
    .toUpperCase()
    .replace(/^EEG\s+/i, "")
    .replace(/-(REF|AVG|LE)$/i, "")
    .trim();

  const parts = cleaned.split(/[-–/\s]+/).filter(Boolean);
  const matched: string[] = [];

  for (const part of parts) {
    const canonical = LEGACY_ALIASES[part] ?? part;
    const exactId = VALID_IDS.get(canonical);
    if (exactId && !matched.includes(exactId)) {
      matched.push(exactId);
    }
  }

  return matched;
}

/**
 * Maps raw EDF display traces (keyed by EDF channel label like "FP1-F7")
 * onto canonical 10-20 electrode IDs ("Fp1", "F7", etc.) with RMS telemetry.
 */
export function mapEdfTracesToElectrodes(
  rawTraces: Record<string, number[]>
): Record<
  string,
  { values: number[]; edfLabel: string; rmsUv: number }
> {
  const out: Record<
    string,
    { values: number[]; edfLabel: string; rmsUv: number }
  > = {};

  for (const [edfLabel, values] of Object.entries(rawTraces)) {
    if (!values || values.length === 0) continue;
    const targets = resolveStandard1020Channels(edfLabel);
    if (targets.length === 0) continue;

    let sumSq = 0;
    for (let i = 0; i < values.length; i++) {
      sumSq += values[i] * values[i];
    }
    const rmsUv = Number(Math.sqrt(sumSq / values.length).toFixed(1));

    for (const elId of targets) {
      // Prefer assigning the first matching bipolar/referential trace per electrode
      if (!out[elId]) {
        out[elId] = { values, edfLabel, rmsUv };
      }
    }
  }

  return out;
}

/**
 * Converts IndexedDB DetectedEvent records into BrainViewer DetectedEvent props
 * and computes normalized per-channel cortical activity (0..1).
 */
export function mapDbEventsToBrainViewer(dbEvents: DbDetectedEvent[]): {
  brainEvents: BrainDetectedEvent[];
  baseActivity: Record<string, number>;
} {
  const baseActivity: Record<string, number> = {};
  for (const el of STANDARD_1020) {
    baseActivity[el.id] = 0.16;
  }

  const brainEvents: BrainDetectedEvent[] = dbEvents.map((ev) => {
    const resolvedChannels = (ev.channels || []).flatMap((ch) =>
      resolveStandard1020Channels(ch)
    );
    const primaryChannel = resolvedChannels[0] ?? "Cz";

    const kind: BrainEventKind =
      ev.event_type === "seizure_candidate"
        ? "burst"
        : ev.event_type === "ied_candidate"
          ? "spike"
          : "slow-wave";

    const weight =
      ev.event_type === "seizure_candidate"
        ? 1.0
        : ev.event_type === "ied_candidate"
          ? 0.82
          : 0.45;

    const conf = Math.max(0.4, Math.min(1, ev.confidence || 0.75));

    const targets =
      resolvedChannels.length > 0 ? resolvedChannels : [primaryChannel];
    for (const chId of targets) {
      const boost = weight * conf;
      baseActivity[chId] = Math.min(
        1,
        Math.max(baseActivity[chId] ?? 0.16, boost)
      );
    }

    const amplitudeUv = Math.round(
      (ev.event_type === "seizure_candidate" ? 110 : 65) + conf * 95
    );

    return {
      id: ev.id,
      t: ev.start_time,
      channel: primaryChannel,
      kind,
      amplitudeUv,
    };
  });

  return { brainEvents, baseActivity };
}