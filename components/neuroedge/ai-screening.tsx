// components/neuroedge/ai-screening.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoHelp } from "@/components/layout/neuroedge-logo";
import {
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Flag,
  MousePointer2,
  Play,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import {
  db,
  type Recording,
  type ScreeningSession,
  type DetectedEvent,
} from "@/lib/storage/db";
import {
  EDGE_MODEL,
  runEdgeScreeningOnRecording,
} from "@/lib/eeg/edge-screening";

type EventKind =
  | "IED candidate"
  | "Suspected seizure"
  | "Artifact"
  | "Review segment";

type ScreeningEvent = {
  id: string;
  time: string;
  seconds: number;
  kind: EventKind;
  duration: string;
  channels: string;
  confidence: string;
  quality: string;
  status: "Model prediction" | "Needs review" | "Human reviewed";
  reviewState: "Needs review" | "Confirmed annotation" | "Rejected";
  note?: string;
};

const fallbackDemoEvents: ScreeningEvent[] = [
  {
    id: "demo-1",
    time: "00:18.42",
    seconds: 18.42,
    kind: "IED candidate",
    duration: "0.8 s",
    channels: "F7, T3, T5",
    confidence: "87%",
    quality: "Good",
    status: "Model prediction",
    reviewState: "Needs review",
  },
  {
    id: "demo-2",
    time: "00:41.08",
    seconds: 41.08,
    kind: "Artifact",
    duration: "4.2 s",
    channels: "Fp1, Fp2",
    confidence: "—",
    quality: "Poor",
    status: "Needs review",
    reviewState: "Needs review",
  },
  {
    id: "demo-3",
    time: "01:12.70",
    seconds: 72.7,
    kind: "Suspected seizure",
    duration: "8.6 s",
    channels: "C3, T3, T5",
    confidence: "74%",
    quality: "Fair",
    status: "Model prediction",
    reviewState: "Needs review",
  },
  {
    id: "demo-4",
    time: "03:26.15",
    seconds: 206.15,
    kind: "Review segment",
    duration: "12.0 s",
    channels: "All channels",
    confidence: "—",
    quality: "Fair",
    status: "Needs review",
    reviewState: "Needs review",
  },
];

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${String(mins).padStart(2, "0")}:${secs}`;
}

function formatMMSS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function mapDbEventToUi(
  ev: DetectedEvent,
  qualityLabel: string,
  noteText?: string,
): ScreeningEvent {
  const kind: EventKind =
    ev.event_type === "seizure_candidate"
      ? "Suspected seizure"
      : ev.event_type === "ied_candidate"
        ? "IED candidate"
        : ev.event_type === "artifact"
          ? "Artifact"
          : "Review segment";

  const reviewState: ScreeningEvent["reviewState"] =
    ev.review_status === "accepted"
      ? "Confirmed annotation"
      : ev.review_status === "rejected"
        ? "Rejected"
        : "Needs review";

  const status: ScreeningEvent["status"] =
    ev.review_status === "accepted" || ev.review_status === "rejected"
      ? "Human reviewed"
      : kind === "Artifact"
        ? "Needs review"
        : "Model prediction";

  const dur = Math.max(0.5, ev.end_time - ev.start_time);

  return {
    id: ev.id,
    time: formatTimestamp(ev.start_time),
    seconds: ev.start_time,
    kind,
    duration: `${dur.toFixed(1)} s`,
    channels: ev.channels?.length ? ev.channels.join(", ") : "All channels",
    confidence:
      kind === "Artifact" ? "—" : `${Math.round((ev.confidence || 0) * 100)}%`,
    quality: kind === "Artifact" ? "Poor" : qualityLabel,
    status,
    reviewState,
    note: noteText ?? "",
  };
}

function statusTone(kind: EventKind) {
  if (kind === "IED candidate")
    return "text-ne-amber border-ne-amber/30 bg-ne-amber/10";
  if (kind === "Suspected seizure")
    return "text-ne-ai border-ne-ai/30 bg-ne-ai/10";
  if (kind === "Artifact")
    return "text-ne-critical border-ne-critical/30 bg-ne-critical/10";
  return "text-ne-cyan border-ne-cyan/30 bg-ne-cyan/10";
}

export function AiScreening() {
  const router = useRouter();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [session, setSession] = useState<ScreeningSession | null>(null);
  const [events, setEvents] = useState<ScreeningEvent[]>(fallbackDemoEvents);
  const [selected, setSelected] = useState<ScreeningEvent>(
    fallbackDemoEvents[0],
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(100);
  const [reviewStatus, setReviewStatus] = useState<
    "Needs review" | "Confirmed annotation" | "Rejected"
  >("Needs review");
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  async function loadScreeningData() {
    const paramId =
      new URLSearchParams(window.location.search).get("recording") ||
      localStorage.getItem("ne_active_recording_id");

    let rec: Recording | undefined;
    if (paramId) {
      rec = await db.recordings.get(paramId);
    }
    if (!rec) {
      const all = await db.recordings
        .orderBy("imported_at")
        .reverse()
        .toArray();
      rec = all[0];
    }
    if (!rec) return;

    setRecording(rec);
    const sessions = await db.screening_sessions
      .where("recording_id")
      .equals(rec.id)
      .toArray();

    console.log("Sessions:", sessions);

    let activeSession = sessions[sessions.length - 1];
    let dbEvents: DetectedEvent[] = [];

    if (!activeSession) {
      setRunning(true);
      setProgress(10);
      const res = await runEdgeScreeningOnRecording(rec, (pct) =>
        setProgress(pct),
      );
      activeSession = res.session;
      dbEvents = res.events;
      setRunning(false);
    } else {
      dbEvents = await db.detected_events
        .where("session_id")
        .equals(activeSession.id)
        .sortBy("start_time");
    }

    setSession(activeSession);
    const annotations = await db.annotations
      .where("session_id")
      .equals(activeSession.id)
      .toArray();
    const notesByEvent = new Map<string, string>();
    for (const ann of annotations) {
      if (ann.notes) notesByEvent.set(ann.event_id, ann.notes);
    }

    const qScore = activeSession.quality_score ?? 94;
    const qualityLabel = qScore >= 85 ? "Good" : qScore >= 70 ? "Fair" : "Poor";

    if (dbEvents.length > 0) {
      const mapped = dbEvents.map((ev) =>
        mapDbEventToUi(ev, qualityLabel, notesByEvent.get(ev.id)),
      );
      setEvents(mapped);
      setSelected(mapped[0]);
      setReviewStatus(mapped[0].reviewState);
      setNote(mapped[0].note ?? "");
    } else {
      const cleanSegment: ScreeningEvent = {
        id: "clean-0",
        time: "00:00.00",
        seconds: 0,
        kind: "Review segment",
        duration: `${Math.round(rec.duration)} s`,
        channels: "All channels",
        confidence: "99%",
        quality: qualityLabel,
        status: "Model prediction",
        reviewState: "Needs review",
      };
      setEvents([cleanSegment]);
      setSelected(cleanSegment);
    }
  }

  useEffect(() => {
    loadScreeningData();
  }, []);

  async function handleUpdateReview(
    nextStatus: "Needs review" | "Confirmed annotation" | "Rejected",
  ) {
    setReviewStatus(nextStatus);
    const dbStatus =
      nextStatus === "Confirmed annotation"
        ? "accepted"
        : nextStatus === "Rejected"
          ? "rejected"
          : "pending";

    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === selected.id
          ? {
              ...ev,
              reviewState: nextStatus,
              status:
                nextStatus === "Needs review"
                  ? "Needs review"
                  : "Human reviewed",
            }
          : ev,
      ),
    );

    if (session && !selected.id.startsWith("demo-")) {
      await db.detected_events.update(selected.id, {
        review_status: dbStatus,
      });
      await db.annotations.add({
        id: crypto.randomUUID(),
        event_id: selected.id,
        session_id: session.id,
        annotation_type: dbStatus,
        notes: note,
        created_at: new Date(),
      });
    }
  }

  async function handleSaveNote() {
    if (session && !selected.id.startsWith("demo-")) {
      await db.annotations.add({
        id: crypto.randomUUID(),
        event_id: selected.id,
        session_id: session.id,
        annotation_type:
          reviewStatus === "Confirmed annotation"
            ? "accepted"
            : reviewStatus === "Rejected"
              ? "rejected"
              : "pending",
        notes: note,
        created_at: new Date(),
      });
    }
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  const totalDur = Math.max(10, recording?.duration ?? 314);
  const iedCount = events.filter((e) => e.kind === "IED candidate").length;
  const szCount = events.filter((e) => e.kind === "Suspected seizure").length;
  const artCount = events.filter((e) => e.kind === "Artifact").length;
  const qScore = session?.quality_score ?? 96;
  const qLabel = qScore >= 85 ? "Good" : qScore >= 70 ? "Fair" : "Poor";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_300px] relative">
        <div className="space-y-5">
          <Panel
            title="Screening overview"
            eyebrow={`${
              recording ? recording.recording_name : "NE-DEMO-01"
            } · selected recording`}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Recording",
                  recording ? recording.recording_name : "NE-DEMO-01",
                ],
                ["Model", `NeuroEdge ${EDGE_MODEL.format}`],
                ["Quality", `${qLabel} · ${qScore}%`],
                [
                  "Duration",
                  recording
                    ? `${formatMMSS(recording.duration)} · ${recording.channel_count} ch`
                    : "05:14 · 19 ch",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-ne-line bg-ne-bg2 p-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-ne-fg-3">
                    {label}
                  </p>
                  <p className="mt-2 truncate font-mono text-xs text-ne-fg">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-ne-line bg-ne-bg2/70 p-3">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-ne-fg-2">
                  {running
                    ? "Processing candidate events…"
                    : "Processing complete"}
                </span>
                <span className="font-mono text-ne-cyan">
                  {running ? `${progress}%` : "100%"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ne-elevated">
                <div
                  className="h-full rounded-full bg-ne-ai transition-all"
                  style={{ width: `${running ? progress : 100}%` }}
                />
              </div>
            </div>
          </Panel>
          <Panel
            title="Screening result"
            eyebrow="Automated triage summary"
            actions={
              <InfoHelp title="How NeuroEdge MLP Scoring Works">
                <p>
                  Each 2-second window (512 samples at 256 Hz) is decomposed
                  into 28 time, frequency, wavelet (db4), and spatial features.
                </p>
                <p>
                  The 3-layer MLP outputs a seizure probability, smoothed over a
                  5-window trailing average. Windows exceeding the{" "}
                  <strong>{EDGE_MODEL.threshold.toFixed(2)}</strong> threshold
                  are flagged for clinician review, while high frontal/posterior
                  blink ratios are gated as artifacts.
                </p>
              </InfoHelp>
            }
          >
            <div className="flex flex-col gap-4 rounded-xl border border-ne-amber/30 bg-ne-amber/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 text-ne-amber" />
                <div>
                  <p className="font-medium text-ne-fg">
                    {szCount > 0 || iedCount > 0
                      ? "Candidate epileptiform activity detected"
                      : "No epileptiform candidates above threshold"}
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-ne-fg-2">
                    {iedCount} IED candidate(s), {szCount} suspected seizure
                    segment(s), and {artCount} artifact segment(s) identified at
                    operating threshold {EDGE_MODEL.threshold.toFixed(2)}.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-ne-amber/30 px-2.5 py-1 font-mono text-[10px] text-ne-amber">
                {szCount > 0 || iedCount > 0 ? "REVIEW REQUIRED" : "SCREENED"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ne-fg-3">
              <span className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1">
                {iedCount} IED candidates
              </span>
              <span className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1">
                {szCount} suspected seizure
              </span>
              <span className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1">
                {artCount} artifact segment
              </span>
            </div>
          </Panel>
          <Panel
            title="Event timeline"
            eyebrow="Click an event to inspect its waveform location"
            actions={
              <button
                onClick={() =>
                  router.push(
                    recording
                      ? `/workspace?recording=${recording.id}`
                      : "/workspace",
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-ne-line px-2.5 py-1.5 text-xs text-ne-fg-2 hover:text-ne-fg"
              >
                <Play className="h-3 w-3" />
                Preview
              </button>
            }
          >
            <div className="mb-4 flex items-center justify-between text-xs text-ne-fg-3">
              <span>00:00</span>
              <span className="font-mono text-ne-cyan">
                Selected: {selected.time}
              </span>
              <span>{formatMMSS(totalDur)}</span>
            </div>
            <div className="relative h-14 rounded-lg border border-ne-line bg-ne-bg2">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ne-line" />
              {events.map((event) => (
                <button
                  key={event.id}
                  aria-label={`Inspect ${event.kind} at ${event.time}`}
                  onClick={() => {
                    setSelected(event);
                    setReviewStatus(event.reviewState);
                    setNote(event.note ?? "");
                  }}
                  className={`absolute top-1/2 h-9 w-2 -translate-y-1/2 rounded-full transition-transform hover:scale-125 ${
                    event.kind === "Artifact"
                      ? "bg-ne-critical"
                      : event.kind === "Suspected seizure"
                        ? "bg-ne-ai"
                        : event.kind === "IED candidate"
                          ? "bg-ne-amber"
                          : "bg-ne-cyan"
                  } ${
                    selected.id === event.id
                      ? "ring-2 ring-white ring-offset-2 ring-offset-ne-bg2"
                      : ""
                  }`}
                  style={{
                    left: `${Math.min(
                      98,
                      Math.max(1, (event.seconds / totalDur) * 100),
                    )}%`,
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ne-fg-2">
              <span>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-amber" />
                Candidate IED
              </span>
              <span>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-ai" />
                Suspected seizure
              </span>
              <span>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-critical" />
                Artifact
              </span>
              <span>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-cyan" />
                Review segment
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => {
                    setSelected(event);
                    setReviewStatus(event.reviewState);
                    setNote(event.note ?? "");
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected.id === event.id
                      ? "border-ne-cyan/50 bg-ne-cyan/5"
                      : "border-ne-line bg-ne-bg2 hover:border-ne-cyan/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-medium ${statusTone(
                        event.kind,
                      )}`}
                    >
                      {event.kind}
                    </span>
                    <span className="font-mono text-xs text-ne-fg">
                      {event.time}
                    </span>
                    <span className="hidden text-xs text-ne-fg-3 sm:inline">
                      {event.channels}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ne-fg-3" />
                </button>
              ))}
            </div>
          </Panel>
        </div>
        <Panel
          title="Event details"
          eyebrow="Human review controls"
          className="h-fit sticky top-[62px]"
        >
          <div className="space-y-4">
            <div
              className={`rounded-lg border p-3 ${statusTone(selected.kind)}`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                {selected.kind}
              </div>
              <p className="mt-1 text-[11px] opacity-80">{selected.status}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ["Timestamp", selected.time],
                ["Duration", selected.duration],
                ["Channels", selected.channels],
                ["Confidence", selected.confidence],
                ["Signal quality", selected.quality],
                ["Review status", reviewStatus],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-ne-fg-3">{label}</p>
                  <p className="mt-1 font-mono text-ne-fg">{value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-ne-line pt-4">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-ne-fg-3">
                Annotation status
              </p>
              <div className="grid gap-2">
                <button
                  onClick={() => handleUpdateReview("Needs review")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${
                    reviewStatus === "Needs review"
                      ? "border-ne-amber/40 bg-ne-amber/10 text-ne-amber"
                      : "border-ne-line text-ne-fg-2"
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  Mark for review
                </button>
                <button
                  onClick={() => handleUpdateReview("Confirmed annotation")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${
                    reviewStatus === "Confirmed annotation"
                      ? "border-ne-emerald/40 bg-ne-emerald/10 text-ne-emerald"
                      : "border-ne-line text-ne-fg-2"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Confirm annotation
                </button>
                <button
                  onClick={() => handleUpdateReview("Rejected")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${
                    reviewStatus === "Rejected"
                      ? "border-ne-critical/40 bg-ne-critical/10 text-ne-critical"
                      : "border-ne-line text-ne-fg-2"
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  Reject candidate
                </button>
              </div>
            </div>
            <div>
              <label
                htmlFor="clinical-note"
                className="mb-2 flex items-center gap-2 text-xs text-ne-fg-2"
              >
                <FileText className="h-3.5 w-3.5" />
                Clinical note
              </label>
              <textarea
                id="clinical-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note for the reviewing clinician…"
                className="min-h-24 w-full resize-y rounded-lg border border-ne-line bg-ne-bg2 p-3 text-xs text-ne-fg outline-none placeholder:text-ne-fg-3 focus:border-ne-cyan"
              />
              <button
                onClick={handleSaveNote}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-2 text-xs text-ne-emerald"
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                {noteSaved ? "Saved" : "Save note"}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
