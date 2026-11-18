// components/brain/BrainViewer.tsx
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/storage/db";
import {
  getElectrodeEducation,
  mapDbEventsToBrainViewer,
  mapEdfTracesToElectrodes,
  REGION_EDUCATION,
} from "@/lib/eeg/brain-bridge";
import { readDisplaySignals } from "@/lib/eeg/edge-screening";
import { generateBandSignal } from "@/lib/eeg/synthetic-signal";
import { Sparkline } from "@/components/charts/sparkline";
import { InfoHelp } from "@/components/layout/neuroedge-logo";
import styles from "./BrainViewer.module.css";
import {
  EVENT_LABEL,
  HUE_HEX,
  REGIONS,
  STANDARD_1020,
  regionHue,
  type DetectedEvent,
  type Electrode,
  type EventKind,
  type RecordingStatus,
  type RegionKey,
  type Selection,
  type ViewMode,
} from "./brain-data";

const BrainScene = dynamic(() => import("./BrainScene"), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      Loading 3D cortical model…
    </div>
  ),
});

export interface BrainViewerProps {
  electrodes?: Electrode[];
  events?: DetectedEvent[];
  channelActivity?: Record<string, number>;
  status?: RecordingStatus;
  recordingStartedAt?: number;
  simulate?: boolean;
  defaultMode?: ViewMode;
  quality?: "low" | "medium" | "high";
  glow?: number;
  onSelectionChange?: (selection: Selection) => void;
  className?: string;
}

const DETAIL = { low: 40, medium: 56, high: 76 } as const;

const MODES: { id: ViewMode; label: string }[] = [
  { id: "overview", label: "Brain overview" },
  { id: "electrodes", label: "Electrode map" },
  { id: "activity", label: "Signal activity" },
];

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

function useSimulatedSignal(
  electrodes: Electrode[],
  enabled: boolean,
  activityRef: MutableRefObject<Record<string, number>>,
) {
  const [events, setEvents] = useState<DetectedEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    const seeds = electrodes.map((_, i) => ({
      f: 0.5 + i * 0.07,
      p: i * 1.3,
    }));
    let seq = 0;

    const tick = setInterval(() => {
      const t = (performance.now() - start) / 1000;
      const next = { ...activityRef.current };
      electrodes.forEach((el, i) => {
        const s = seeds[i];
        const target =
          0.3 +
          0.16 * Math.sin(t * s.f + s.p) +
          0.1 * Math.sin(t * 2.3 + i * 1.7);
        const prev = next[el.id] ?? target;
        next[el.id] = Math.min(1, Math.max(0, prev * 0.75 + target * 0.25));
      });
      activityRef.current = next;
    }, 100);

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          const el = electrodes[Math.floor(Math.random() * electrodes.length)];
          const kinds: EventKind[] = ["spike", "burst", "slow-wave"];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          const ev: DetectedEvent = {
            id: `sim-${++seq}`,
            t: (performance.now() - start) / 1000,
            channel: el.id,
            kind,
            amplitudeUv: Math.round(40 + Math.random() * 160),
          };
          activityRef.current = { ...activityRef.current, [el.id]: 1 };
          setEvents((prev) => [ev, ...prev].slice(0, 12));
          schedule();
        },
        2500 + Math.random() * 3500,
      );
    };
    schedule();

    return () => {
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [electrodes, enabled, activityRef]);

  return events;
}

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
};

const fmtMs = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
    Math.floor(s % 60),
  ).padStart(2, "0")}`;

const sameSelection = (a: Selection, b: Selection) =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  ("id" in a && "id" in b
    ? a.id === b.id
    : "key" in a && "key" in b && a.key === b.key);

export default function BrainViewer({
  electrodes = STANDARD_1020,
  events: eventsProp,
  channelActivity,
  status = "recording",
  recordingStartedAt,
  simulate,
  defaultMode = "overview",
  quality = "low",
  glow = 1,
  onSelectionChange,
  className,
}: BrainViewerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [selection, setSelection] = useState<Selection>(null);
  const reduced = usePrefersReducedMotion();
  const [nodeTraces, setNodeTraces] = useState<
    Record<string, { values: number[]; edfLabel: string; rmsUv: number }>
  >({});

  // Subscribe to the latest uploaded EDF recording and its screened events in IndexedDB
  const dbState = useLiveQuery(async () => {
    try {
      const activeId =
        typeof window !== "undefined"
          ? localStorage.getItem("ne_active_recording_id")
          : null;
      let rec = activeId ? await db.recordings.get(activeId) : undefined;
      if (!rec) {
        const all = await db.recordings
          .orderBy("imported_at")
          .reverse()
          .toArray();
        rec = all[0];
      }
      if (!rec) return null;

      const sessions = await db.screening_sessions
        .where("recording_id")
        .equals(rec.id)
        .toArray();
      const latestSession = sessions[sessions.length - 1];
      if (!latestSession) {
        return { recording: rec, brainEvents: [], baseActivity: {} };
      }

      const rawEvents = await db.detected_events
        .where("session_id")
        .equals(latestSession.id)
        .sortBy("start_time");

      const { brainEvents, baseActivity } = mapDbEventsToBrainViewer(rawEvents);
      return { recording: rec, brainEvents, baseActivity };
    } catch {
      return null;
    }
  }, []);

  const hasDbRecording = !!dbState?.recording;
  const hasDbScreening =
    !!dbState &&
    eventsProp === undefined &&
    channelActivity === undefined &&
    dbState.brainEvents.length > 0;

  const simulating =
    simulate ??
    (eventsProp === undefined &&
      channelActivity === undefined &&
      !hasDbScreening);

  const activityRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (channelActivity) {
      activityRef.current = channelActivity;
    }
  }, [channelActivity]);

  const selectedEvent =
    selection?.kind === "event"
      ? (eventsProp ?? (hasDbScreening ? dbState!.brainEvents : [])).find(
          (e) => e.id === selection.id,
        )
      : undefined;

  // Load real physical EDF waveform traces mapped onto the 10-20 brain nodes
  useEffect(() => {
    const rec = dbState?.recording;
    if (!rec?.file_blob) return;
    let cancelled = false;
    const targetStartSec = selectedEvent ? Math.max(0, selectedEvent.t - 1) : 0;

    readDisplaySignals(rec.file_blob, targetStartSec, 4, {
      highPassHz: 0.5,
      lowPassHz: 45,
      notchHz: 50,
    })
      .then((rawTraces) => {
        if (cancelled) return;
        const mapped = mapEdfTracesToElectrodes(rawTraces);
        setNodeTraces(mapped);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [dbState?.recording, selectedEvent?.id]);

  // Animate cortical activity around real EDF event channels + RMS levels
  useEffect(() => {
    if (!hasDbRecording || !dbState) return;
    const base = { ...dbState.baseActivity };

    // Incorporate live channel RMS into cortical node glow
    for (const [elId, traceInfo] of Object.entries(nodeTraces)) {
      const normRms = Math.min(0.95, Math.max(0.18, traceInfo.rmsUv / 85));
      base[elId] = Math.max(base[elId] ?? 0.16, normRms);
    }
    activityRef.current = base;

    const start = performance.now();
    const seeds = electrodes.map((_, i) => ({
      f: 0.6 + i * 0.08,
      p: i * 1.1,
    }));

    const tick = setInterval(() => {
      const t = (performance.now() - start) / 1000;
      const next: Record<string, number> = {};
      electrodes.forEach((el, i) => {
        const b = base[el.id] ?? 0.2;
        const s = seeds[i];
        const osc = 0.08 * Math.sin(t * s.f + s.p);
        next[el.id] = Math.min(1, Math.max(0.05, b + osc));
      });
      activityRef.current = next;
    }, 100);

    return () => clearInterval(tick);
  }, [hasDbRecording, dbState, nodeTraces, electrodes]);

  const simEvents = useSimulatedSignal(
    electrodes,
    simulating && status === "recording",
    activityRef,
  );

  const events =
    eventsProp ?? (hasDbScreening ? dbState!.brainEvents : simEvents);

  const startedAt = useRef(recordingStartedAt ?? Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (recordingStartedAt) startedAt.current = recordingStartedAt;
  }, [recordingStartedAt]);
  useEffect(() => {
    if (status !== "recording") return;
    const tick = () => setElapsed((Date.now() - startedAt.current) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  const choose = useCallback(
    (next: Selection) => {
      setSelection((prev) => {
        const value = sameSelection(prev, next) ? null : next;
        onSelectionChange?.(value);
        return value;
      });
    },
    [onSelectionChange],
  );

  const changeMode = (m: ViewMode) => {
    setMode(m);
    setSelection((prev) => {
      if (!prev) return prev;
      if (m === "overview" && prev.kind !== "region") return null;
      if (m !== "overview" && prev.kind === "region") return null;
      return prev;
    });
  };

  const activeEvent =
    selection?.kind === "event"
      ? events.find((e) => e.id === selection.id)
      : undefined;
  const selectedElectrode =
    selection?.kind === "electrode"
      ? electrodes.find((e) => e.id === selection.id)
      : activeEvent
        ? electrodes.find((e) => e.id === activeEvent.channel)
        : undefined;
  const selectedRegionKey =
    selection?.kind === "region" ? selection.key : undefined;

  const topChannels = useMemo(
    () =>
      [...electrodes]
        .sort(
          (a, b) =>
            (activityRef.current[b.id] ?? 0) - (activityRef.current[a.id] ?? 0),
        )
        .slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [electrodes, events, nodeTraces],
  );

  return (
    <section
      className={`${styles.root} ${className ?? ""}`}
      aria-label="3D brain viewer"
    >
      <div className={styles.stage}>
        <BrainScene
          mode={mode}
          electrodes={electrodes}
          selection={selection}
          events={events}
          activityRef={activityRef}
          onSelectElectrode={(id) => choose({ kind: "electrode", id })}
          reducedMotion={reduced}
          detail={DETAIL[quality]}
          exposure={glow}
        />

        {/* <RecordingPill
          status={status}
          label={
            hasDbRecording
              ? dbState!.recording.recording_name
              : status === "recording"
                ? "Active"
                : "Standby"
          }
          elapsed={hasDbRecording ? dbState!.recording.duration : elapsed}
          channels={
            hasDbRecording
              ? dbState!.recording.channel_count
              : electrodes.length
          }
        /> */}

        <div className={styles.modes} role="group" aria-label="View mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.mode}
              aria-pressed={mode === m.id}
              onClick={() => changeMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <aside className={styles.panel} aria-live="polite">
        {mode === "overview" && (
          <>
            <div className={styles.headRow}>
              <h2 className={styles.h}>Cortical Regions</h2>
              <InfoHelp title="3D Cortical & Tract Model">
                <p>
                  Interactive 3D anatomical view of the cerebral lobes,
                  cerebellum, and white-matter pathways (corpus callosum,
                  arcuate, and projection tracts).
                </p>
                <p>
                  Select any lobe below to highlight its territory on both
                  hemispheres and inspect its EEG clinical role.
                </p>
              </InfoHelp>
            </div>
            <p className={styles.sub}>
              Select a lobe to inspect its functional role and mapped 10-20
              electrodes.
            </p>
            <ul className={styles.list}>
              {REGIONS.map((r) => {
                const on =
                  selection?.kind === "region" && selection.key === r.key;
                return (
                  <li key={r.key}>
                    <button
                      type="button"
                      className={styles.row}
                      aria-pressed={on}
                      onClick={() =>
                        choose({ kind: "region", key: r.key as RegionKey })
                      }
                    >
                      <span
                        className={styles.dot}
                        style={{ background: HUE_HEX[r.hue] }}
                      />
                      <span className={styles.rowText}>
                        <strong>{r.label}</strong>
                        <span>{r.summary}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedRegionKey && (
              <div className={styles.locIllustrative} style={{ marginTop: 12 }}>
                <span className={styles.badge}>
                  {REGIONS.find((r) => r.key === selectedRegionKey)?.label} EEG
                  Guide
                </span>
                <strong>
                  Electrodes:{" "}
                  {REGION_EDUCATION[selectedRegionKey].keyElectrodes}
                </strong>
                <p>{REGION_EDUCATION[selectedRegionKey].eegRole}</p>
                <p>
                  <strong>Seizure semiology:</strong>{" "}
                  {REGION_EDUCATION[selectedRegionKey].seizureSemiology}
                </p>
              </div>
            )}
          </>
        )}

        {mode === "electrodes" && (
          <>
            <div className={styles.headRow}>
              <h2 className={styles.h}>10-20 Electrode Map</h2>
              <InfoHelp title="International 10-20 System">
                <p>
                  <strong>Letters</strong> identify the underlying lobe:
                  <strong> Fp</strong> (Frontopolar), <strong>F</strong>{" "}
                  (Frontal), <strong>C</strong> (Central), <strong>T</strong>{" "}
                  (Temporal), <strong>P</strong> (Parietal), <strong>O</strong>{" "}
                  (Occipital).
                </p>
                <p>
                  <strong>Odd numbers</strong> (1, 3, 5, 7) sit on the{" "}
                  <strong>Left hemisphere</strong>;{" "}
                  <strong>Even numbers</strong> (2, 4, 6, 8) sit on the{" "}
                  <strong>Right hemisphere</strong>; <strong>z</strong> marks
                  the midline.
                </p>
              </InfoHelp>
            </div>
            <p className={styles.sub}>
              Click any node on the 3D head or grid to inspect its live EDF
              channel waveform and clinical guide.
            </p>
            <div className={styles.chips}>
              {electrodes.map((el) => {
                const hasTrace = !!nodeTraces[el.id];
                return (
                  <button
                    key={el.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={selectedElectrode?.id === el.id}
                    onClick={() => choose({ kind: "electrode", id: el.id })}
                  >
                    <span
                      className={styles.dot}
                      style={{
                        background: HUE_HEX[regionHue(el.region)],
                        opacity: hasTrace || !hasDbRecording ? 1 : 0.4,
                      }}
                    />
                    {el.label}
                  </button>
                );
              })}
            </div>
            {selectedElectrode ? (
              <ElectrodeDetail
                electrode={selectedElectrode}
                trace={nodeTraces[selectedElectrode.id]}
                recordingId={dbState?.recording?.id}
                onOpenWorkspace={(startSec) => {
                  if (dbState?.recording?.id) {
                    router.push(
                      `/workspace?recording=${dbState.recording.id}&start=${Math.floor(
                        startSec,
                      )}`,
                    );
                  } else {
                    router.push("/workspace");
                  }
                }}
              />
            ) : (
              <p className={styles.empty}>
                Select an electrode node (e.g. Fp1, T7, C3, O1) to view its live
                EEG trace and anatomical guide.
              </p>
            )}
          </>
        )}

        {mode === "activity" && (
          <>
            <div className={styles.headRow}>
              <div className="flex items-center gap-2">
                <h2 className={styles.h}>Signal Activity</h2>
                <InfoHelp title="Cortical Event Mapping">
                  <p>
                    Displays candidate epileptiform events extracted by the
                    28-feature NeuroEdge MLP model (Daubechies-4 wavelets,
                    Teager-Kaiser energy, Hjorth parameters, and Spectral
                    Entropy).
                  </p>
                  <p>
                    Click any event to rotate the 3D cortex to the active
                    channel and inspect its waveform segment.
                  </p>
                </InfoHelp>
              </div>
              {dbState?.recording && (
                <span
                  className={styles.sim}
                  title={dbState.recording.recording_name}
                >
                  {dbState.recording.recording_name}
                </span>
              )}
            </div>
            <p className={styles.sub}>
              Select an event to focus the 3D cortex on its onset channel and
              inspect the trace.
            </p>
            {events.length === 0 ? (
              <p className={styles.empty}>No events flagged in this session.</p>
            ) : (
              <ul className={styles.list}>
                {events.map((ev) => {
                  const el = electrodes.find((e) => e.id === ev.channel);
                  const on =
                    selection?.kind === "event" && selection.id === ev.id;
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        className={`${styles.row} ${styles.evRow}`}
                        aria-pressed={on}
                        onClick={() => choose({ kind: "event", id: ev.id })}
                      >
                        <span className={styles.data}>{fmtMs(ev.t)}</span>
                        <span
                          className={styles.dot}
                          style={{
                            background: HUE_HEX[el ? regionHue(el.region) : 1],
                          }}
                        />
                        <span className={styles.rowText}>
                          <strong>
                            {EVENT_LABEL[ev.kind]} · {ev.channel}
                          </strong>
                        </span>
                        <span className={styles.data}>{ev.amplitudeUv} µV</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {selectedElectrode && (
              <ElectrodeDetail
                electrode={selectedElectrode}
                event={activeEvent}
                trace={nodeTraces[selectedElectrode.id]}
                recordingId={dbState?.recording?.id}
                onOpenWorkspace={(startSec) => {
                  if (dbState?.recording?.id) {
                    router.push(
                      `/workspace?recording=${dbState.recording.id}&start=${Math.floor(
                        startSec,
                      )}`,
                    );
                  } else {
                    router.push("/workspace");
                  }
                }}
              />
            )}

            {!selectedElectrode && topChannels.length > 0 && (
              <p className={styles.fine}>
                Peak active nodes: {topChannels.map((c) => c.label).join(", ")}.
              </p>
            )}
          </>
        )}
      </aside>
    </section>
  );
}

function RecordingPill({
  status,
  label,
  elapsed,
  channels,
}: {
  status: RecordingStatus;
  label: string;
  elapsed: number;
  channels: number;
}) {
  return (
    <div className={`${styles.rec} ${styles[`rec_${status}`]}`} role="status">
      <span className={styles.recDot} aria-hidden="true" />
      <span className="max-w-[140px] truncate font-medium">{label}</span>
      {status !== "standby" && (
        <span className={styles.data}>{fmtClock(elapsed)}</span>
      )}
      <span className={styles.recSep} aria-hidden="true" />
      <span className={styles.data}>{channels} ch</span>
    </div>
  );
}

function ElectrodeDetail({
  electrode,
  event,
  trace,
  recordingId,
  onOpenWorkspace,
}: {
  electrode: Electrode;
  event?: DetectedEvent;
  trace?: { values: number[]; edfLabel: string; rmsUv: number };
  recordingId?: string;
  onOpenWorkspace?: (startSec: number) => void;
}) {
  const hemi =
    electrode.hemisphere === "midline"
      ? "Midline"
      : `${electrode.hemisphere[0].toUpperCase()}${electrode.hemisphere.slice(
          1,
        )} hemisphere`;

  const edu = getElectrodeEducation(electrode.id);
  const sparkValues = useMemo(() => {
    if (trace?.values && trace.values.length > 0) {
      return trace.values.slice(0, 140);
    }
    return generateBandSignal("alpha", {
      points: 120,
      seed: electrode.id.charCodeAt(0),
    });
  }, [trace, electrode.id]);

  return (
    <div className={styles.detail}>
      <h3 className={styles.detailTitle}>
        <span>
          <strong className="font-mono text-base text-ne-fg">
            {electrode.label}
          </strong>{" "}
          · {electrode.regionLabel}
        </span>
        <span>{hemi}</span>
      </h3>

      {event && (
        <p className={styles.eventLine}>
          {EVENT_LABEL[event.kind]} at{" "}
          <span className={styles.data}>{fmtMs(event.t)}</span> ·{" "}
          <span className={styles.data}>{event.amplitudeUv} µV</span>
        </p>
      )}

      {/* Live EDF Signal Trace Card for this 3D Node */}
      <div className={styles.locIllustrative}>
        <div className="flex items-center justify-between gap-2">
          <span className={styles.badge}>
            {trace
              ? `EDF Channel: ${trace.edfLabel}`
              : `Node ${electrode.label} Signal`}
          </span>
          <span className={styles.data}>
            {trace ? `RMS ${trace.rmsUv} µV` : "256 Hz"}
          </span>
        </div>
        <Sparkline
          values={sparkValues}
          color={HUE_HEX[regionHue(electrode.region)]}
          className="my-1 h-10 w-full"
        />
        {onOpenWorkspace && (
          <button
            type="button"
            onClick={() => onOpenWorkspace(event ? event.t : 0)}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-ne-cyan hover:underline"
          >
            {recordingId
              ? `Inspect ${trace?.edfLabel ?? electrode.label} in EEG Workspace`
              : "Open EEG Workspace"}
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Educational Neurophysiology Guide for this Node */}
      <div className={styles.locIllustrative}>
        <span className={styles.badge}>Clinical & DSP Guide</span>
        <p>
          <strong>Anatomical placement:</strong> {edu.role}
        </p>
        <p>
          <strong>Normal rhythm:</strong> {edu.normalRhythm}
        </p>
        <p>
          <strong>Triage features:</strong> {edu.epileptiformClue}
        </p>
      </div>
    </div>
  );
}
