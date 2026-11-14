// lib/eeg/brain-bridge.ts
import {
  STANDARD_1020,
  type DetectedEvent as BrainDetectedEvent,
  type EventKind as BrainEventKind,
} from "@/components/brain/brain-data";
import type { DetectedEvent as DbDetectedEvent } from "@/lib/storage/db";

const VALID_IDS = new Map<string, string>(
  STANDARD_1020.map((el) => [el.id.toUpperCase(), el.id])
);

// Legacy 10-20 aliases (T3/T4/T5/T6 -> T7/T8/P7/P8)
const LEGACY_ALIASES: Record<string, string> = {
  T3: "T7",
  T4: "T8",
  T5: "P7",
  T6: "P8",
};

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

    // Boost cortical activity on all electrodes involved in this event
    const targets =
      resolvedChannels.length > 0 ? resolvedChannels : [primaryChannel];
    for (const chId of targets) {
      const boost = weight * conf;
      baseActivity[chId] = Math.min(
        1,
        Math.max(baseActivity[chId] ?? 0.16, boost)
      );
    }

    // Estimate illustrative display amplitude in uV from event type & confidence
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