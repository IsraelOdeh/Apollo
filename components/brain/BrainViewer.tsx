"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
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
      Building brain model…
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface BrainViewerProps {
  /** Channel layout. Defaults to the standard 10-20 set (19 channels). */
  electrodes?: Electrode[];
  /** Detected events from your pipeline. Omit to use the built-in simulator. */
  events?: DetectedEvent[];
  /** Live per-channel activity, 0..1, keyed by electrode id. */
  channelActivity?: Record<string, number>;
  status?: RecordingStatus;
  /** Epoch ms when the recording began; defaults to mount time. */
  recordingStartedAt?: number;
  /** Run the demo signal simulator. Defaults to true when no live data is passed. */
  simulate?: boolean;
  defaultMode?: ViewMode;
  /** Mesh density: low is kinder to phones. */
  quality?: "low" | "medium" | "high";
  /** Brightness multiplier for the glow, 1 by default. */
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

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

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

/** Demo-only: smooth per-channel activity plus occasional detected events. */
function useSimulatedSignal(
  electrodes: Electrode[],
  enabled: boolean,
  activityRef: MutableRefObject<Record<string, number>>,
) {
  const [events, setEvents] = useState<DetectedEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    const seeds = electrodes.map((_, i) => ({ f: 0.5 + i * 0.07, p: i * 1.3 }));
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
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const sameSelection = (a: Selection, b: Selection) =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  ("id" in a && "id" in b
    ? a.id === b.id
    : "key" in a && "key" in b && a.key === b.key);

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function BrainViewer({
  electrodes = STANDARD_1020,
  events: eventsProp,
  channelActivity,
  status = "recording",
  recordingStartedAt,
  simulate,
  defaultMode = "overview",
  quality = "medium",
  glow = 1,
  onSelectionChange,
  className,
}: BrainViewerProps) {
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [selection, setSelection] = useState<Selection>(null);
  const reduced = usePrefersReducedMotion();

  const simulating =
    simulate ?? (eventsProp === undefined && channelActivity === undefined);
  const activityRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (channelActivity) activityRef.current = channelActivity;
  }, [channelActivity]);
  const simEvents = useSimulatedSignal(
    electrodes,
    simulating && status === "recording",
    activityRef,
  );
  const events = eventsProp ?? simEvents;

  /* recording clock */
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

  const selectedEvent =
    selection?.kind === "event"
      ? events.find((e) => e.id === selection.id)
      : undefined;
  const selectedElectrode =
    selection?.kind === "electrode"
      ? electrodes.find((e) => e.id === selection.id)
      : selectedEvent
        ? electrodes.find((e) => e.id === selectedEvent.channel)
        : undefined;

  const topChannels = useMemo(
    () =>
      [...electrodes]
        .sort(
          (a, b) =>
            (activityRef.current[b.id] ?? 0) - (activityRef.current[a.id] ?? 0),
        )
        .slice(0, 3),
    // re-sorted whenever the event list changes, which is a good-enough cadence for the readout
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [electrodes, events],
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

        <RecordingPill
          status={status}
          elapsed={elapsed}
          channels={electrodes.length}
        />

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

        <p className={styles.note}>
          <span className={styles.noteMark} aria-hidden="true" />
          Template brain. Highlights are illustrative, not validated clinical
          localization.
        </p>
      </div>

      <aside className={styles.panel} aria-live="polite">
        {mode === "overview" && (
          <>
            <h2 className={styles.h}>Regions</h2>
            <p className={styles.sub}>
              Select a region to highlight it on both hemispheres.
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
            <p className={styles.fine}>
              Glowing fibre bundles are schematic (callosal, association and
              projection tracts). They are not tractography.
            </p>
          </>
        )}

        {mode === "electrodes" && (
          <>
            <h2 className={styles.h}>Electrode map</h2>
            <p className={styles.sub}>
              Select a channel, here or on the head, to see the area it sits
              over.
            </p>
            <div className={styles.chips}>
              {electrodes.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={selectedElectrode?.id === el.id}
                  onClick={() => choose({ kind: "electrode", id: el.id })}
                >
                  <span
                    className={styles.dot}
                    style={{ background: HUE_HEX[regionHue(el.region)] }}
                  />
                  {el.label}
                </button>
              ))}
            </div>
            {selectedElectrode ? (
              <ElectrodeDetail electrode={selectedElectrode} />
            ) : (
              <p className={styles.empty}>
                No channel selected. Pick one to highlight its region.
              </p>
            )}
          </>
        )}

        {mode === "activity" && (
          <>
            <div className={styles.headRow}>
              <h2 className={styles.h}>Detected events</h2>
              {simulating && (
                <span className={styles.sim}>Simulated signal</span>
              )}
            </div>
            <p className={styles.sub}>
              {status === "recording"
                ? "Select an event to highlight where it was detected."
                : "Recording is not running. No new events are being detected."}
            </p>
            {events.length === 0 ? (
              <p className={styles.empty}>Waiting for the first event.</p>
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
                            {EVENT_LABEL[ev.kind]} on {ev.channel}
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
                event={selectedEvent}
              />
            )}
            {!selectedElectrode && topChannels.length > 0 && (
              <p className={styles.fine}>
                Most active now: {topChannels.map((c) => c.label).join(", ")}.
              </p>
            )}
          </>
        )}
      </aside>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function RecordingPill({
  status,
  elapsed,
  channels,
}: {
  status: RecordingStatus;
  elapsed: number;
  channels: number;
}) {
  const text =
    status === "recording"
      ? "Recording"
      : status === "paused"
        ? "Paused"
        : "Standby";
  return (
    <div className={`${styles.rec} ${styles[`rec_${status}`]}`} role="status">
      <span className={styles.recDot} aria-hidden="true" />
      <span>{text}</span>
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
}: {
  electrode: Electrode;
  event?: DetectedEvent;
}) {
  const loc = electrode.localization;
  const validated = loc?.status === "validated";
  const hemi =
    electrode.hemisphere === "midline"
      ? "Midline"
      : `${electrode.hemisphere[0].toUpperCase()}${electrode.hemisphere.slice(1)} hemisphere`;
  return (
    <div className={styles.detail}>
      <h3 className={styles.detailTitle}>
        {electrode.label}
        <span>{hemi}</span>
      </h3>
      {event && (
        <p className={styles.eventLine}>
          {EVENT_LABEL[event.kind]} at{" "}
          <span className={styles.data}>{fmtMs(event.t)}</span>,{" "}
          <span className={styles.data}>{event.amplitudeUv} µV</span>
        </p>
      )}

      <div className={styles.locIllustrative}>
        <span className={styles.badge}>Illustrative</span>
        <strong>{electrode.regionLabel}</strong>
        <p>
          Estimated from the standard 10-20 layout on a template brain. Not
          based on this person&rsquo;s imaging, so do not use it for clinical
          localization.
        </p>
      </div>

      {validated ? (
        <div className={styles.locValidated}>
          <span className={`${styles.badge} ${styles.badgeOk}`}>Validated</span>
          <strong>{loc!.regionLabel}</strong>
          {loc!.method && <p>Method: {loc!.method}</p>}
          {loc!.reference && <p>Reference: {loc!.reference}</p>}
          <p>
            Shown as supplied. The highlight on the template brain stays
            approximate.
          </p>
        </div>
      ) : (
        <div className={styles.locNone}>
          <span className={styles.badge}>Validated</span>
          <strong>Not provided</strong>
          <p>No subject-specific localization was supplied for this channel.</p>
        </div>
      )}
    </div>
  );
}
