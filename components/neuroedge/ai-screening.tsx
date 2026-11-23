// components/neuroedge/ai-screening.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Flag,
  MousePointer2,
  Play,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { InfoHelp } from "@/components/layout/neuroedge-logo";
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
import {
  formatCalibratedConfidence,
  purgeSingleRecording,
  useWorkstationPolicy,
} from "@/lib/privacy/workstation-policy";

type EventKind =
  | "IED candidate"
  | "Suspected seizure"
  | "Inconclusive / Abstain"
  | "Artifact"
  | "Review segment";

type ScreeningEvent = {
  id: string;
  rawType: string;
  time: string;
  seconds: number;
  kind: EventKind;
  duration: string;
  channels: string;
  confidenceTier: string;
  confidenceDetail: string;
  quality: string;
  status: "Model estimate" | "Abstained" | "Needs review" | "Human reviewed";
  reviewState: "Needs review" | "Confirmed annotation" | "Rejected";
  note?: string;
};

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

/**
 * Maps an IndexedDB DetectedEvent row into a calibrated UI event record.
 */
function mapDbEventToUi(
  ev: DetectedEvent,
  qualityLabel: string,
  threshold: number,
  noteText?: string,
): ScreeningEvent {
  const kind: EventKind =
    ev.event_type === "seizure_candidate"
      ? "Suspected seizure"
      : ev.event_type === "ied_candidate"
        ? "IED candidate"
        : ev.event_type === "abstain_unreliable"
          ? "Inconclusive / Abstain"
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
      : kind === "Inconclusive / Abstain"
        ? "Abstained"
        : kind === "Artifact"
          ? "Needs review"
          : "Model estimate";

  const dur = Math.max(0.5, ev.end_time - ev.start_time);
  const calibrated = formatCalibratedConfidence(
    ev.event_type,
    ev.confidence || 0,
    threshold,
  );

  return {
    id: ev.id,
    rawType: ev.event_type,
    time: formatTimestamp(ev.start_time),
    seconds: ev.start_time,
    kind,
    duration: `${dur.toFixed(1)} s`,
    channels: ev.channels?.length ? ev.channels.join(", ") : "All channels",
    confidenceTier: calibrated.label,
    confidenceDetail: calibrated.detail,
    quality:
      kind === "Artifact" || kind === "Inconclusive / Abstain"
        ? "Poor"
        : qualityLabel,
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
  if (kind === "Inconclusive / Abstain")
    return "text-rose-400 border-rose-400/35 bg-rose-500/10";
  if (kind === "Artifact")
    return "text-ne-critical border-ne-critical/30 bg-ne-critical/10";
  return "text-ne-cyan border-ne-cyan/30 bg-ne-cyan/10";
}

export function AiScreening() {
  const router = useRouter();
  const { policy, updatePolicy } = useWorkstationPolicy();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [session, setSession] = useState<ScreeningSession | null>(null);
  const [events, setEvents] = useState<ScreeningEvent[]>([]);
  const [selected, setSelected] = useState<ScreeningEvent | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(100);
  const [reviewStatus, setReviewStatus] = useState<
    "Needs review" | "Confirmed annotation" | "Rejected"
  >("Needs review");
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [purging, setPurging] = useState(false);

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
    if (!rec) {
      setRecording(null);
      setSession(null);
      setEvents([]);
      setSelected(null);
      return;
    }

    setRecording(rec);
    const sessions = await db.screening_sessions
      .where("recording_id")
      .equals(rec.id)
      .toArray();

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
    const qualityLabel = qScore >= 85 ? "Good" : qScore >= 65 ? "Fair" : "Poor";
    const usedThreshold =
      Number(activeSession.preprocessing_config?.threshold) ||
      policy.operatingThreshold ||
      EDGE_MODEL.threshold;

    if (dbEvents.length > 0) {
      const mapped = dbEvents.map((ev) =>
        mapDbEventToUi(ev, qualityLabel, usedThreshold, notesByEvent.get(ev.id)),
      );
      setEvents(mapped);
      setSelected(mapped[0]);
      setReviewStatus(mapped[0].reviewState);
      setNote(mapped[0].note ?? "");
    } else {
      const cleanSegment: ScreeningEvent = {
        id: "clean-0",
        rawType: "review_segment",
        time: "00:00.00",
        seconds: 0,
        kind: "Review segment",
        duration: `${Math.round(rec.duration)} s`,
        channels: "All channels",
        confidenceTier: "Below threshold",
        confidenceDetail: "No epileptiform candidates exceeded operating threshold",
        quality: qualityLabel,
        status: "Model estimate",
        reviewState: "Needs review",
      };
      setEvents([cleanSegment]);
      setSelected(cleanSegment);
      setReviewStatus("Needs review");
      setNote("");
    }
  }

  useEffect(() => {
    loadScreeningData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Persists human clinician review decision and reviewer attribution into IndexedDB.
   */
  async function handleUpdateReview(
    nextStatus: "Needs review" | "Confirmed annotation" | "Rejected",
  ) {
    if (!selected) return;
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
                  ? ev.kind === "Inconclusive / Abstain"
                    ? "Abstained"
                    : "Needs review"
                  : "Human reviewed",
            }
          : ev,
      ),
    );

    if (session && selected.id !== "clean-0") {
      await db.detected_events.update(selected.id, {
        review_status: dbStatus,
      });
      await db.annotations.add({
        id: crypto.randomUUID(),
        event_id: selected.id,
        session_id: session.id,
        annotation_type: dbStatus,
        notes: note,
        reviewer_id: policy.reviewerName,
        created_at: new Date(),
      });
    }
  }

  async function handleSaveNote() {
    if (!selected) return;
    if (session && selected.id !== "clean-0") {
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
        reviewer_id: policy.reviewerName,
        created_at: new Date(),
      });
    }
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  /**
   * Immediately erases the active recording and all derived triage records from local storage.
   */
  async function handlePurgeSession() {
    if (!recording) return;
    setPurging(true);
    try {
      await purgeSingleRecording(recording.id);
      await loadScreeningData();
    } finally {
      setPurging(false);
    }
  }

  // Empty state when no local EDF has been imported yet (or after session purge)
  if (!recording) {
    return (
      <Panel
        title="No active recording loaded"
        eyebrow="Local-first screening"
      >
        <div className="flex flex-col items-start gap-4 py-4">
          <p className="max-w-xl text-sm text-ne-fg-2">
            Import a local EDF or EDF+ recording in EEG Workspace to run
            on-device feature extraction and seizure triage. All waveforms
            remain inside your browser&apos;s local storage.
          </p>
          <button
            type="button"
            onClick={() => router.push("/workspace")}
            className="inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-4 py-2 text-xs font-medium text-ne-emerald hover:bg-ne-emerald/20"
          >
            <Play className="h-3.5 w-3.5" />
            Open EEG Workspace
          </button>
        </div>
      </Panel>
    );
  }

  const totalDur = Math.max(10, recording.duration);
  const iedCount = events.filter((e) => e.kind === "IED candidate").length;
  const szCount = events.filter((e) => e.kind === "Suspected seizure").length;
  const abstainCount = events.filter(
    (e) => e.kind === "Inconclusive / Abstain",
  ).length;
  const artCount = events.filter((e) => e.kind === "Artifact").length;
  const qScore = session?.quality_score ?? 96;
  const qLabel = qScore >= 85 ? "Good" : qScore >= 65 ? "Fair" : "Poor";
  const isPoorOverall = qScore < 65;

  // Caregiver / Education role hides raw model probabilities and unverified diagnostic flags
  if (policy.role === "education") {
    return (
      <div className="space-y-5">
        <Panel
          title="Session summary (Education view)"
          eyebrow={`${recording.recording_name} · plain-language overview`}
          actions={
            <button
              type="button"
              onClick={() => updatePolicy({ role: "clinician" })}
              className="rounded-lg border border-ne-line px-3 py-1.5 text-xs text-ne-fg-2 hover:border-ne-cyan hover:text-ne-fg"
            >
              Switch to Clinician view
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-ne-line bg-ne-bg2 p-4">
              <p className="text-[10px] uppercase tracking-wider text-ne-fg-3">
                Recording length
              </p>
              <p className="mt-2 font-mono text-base text-ne-fg">
                {formatMMSS(recording.duration)} · {recording.channel_count} ch
              </p>
            </div>
            <div className="rounded-xl border border-ne-line bg-ne-bg2 p-4">
              <p className="text-[10px] uppercase tracking-wider text-ne-fg-3">
                Signal quality
              </p>
              <p className="mt-2 font-mono text-base text-ne-fg">
                {qLabel} ({qScore}%)
              </p>
            </div>
            <div className="rounded-xl border border-ne-line bg-ne-bg2 p-4">
              <p className="text-[10px] uppercase tracking-wider text-ne-fg-3">
                Clinician review queue
              </p>
              <p className="mt-2 font-mono text-base text-ne-fg">
                {szCount + iedCount > 0
                  ? `${szCount + iedCount} segments queued`
                  : "Routine background"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ne-cyan/25 bg-ne-cyan/5 p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 size-5 shrink-0 text-ne-cyan" />
              <div className="text-xs leading-5 text-ne-fg-2">
                <p className="font-medium text-ne-fg">
                  Unreviewed model scores are hidden in Education view
                </p>
                <p className="mt-1">
                  Detailed waveform candidates and review actions are scoped to
                  Clinician view. Explore how 10-20 scalp electrodes map to
                  cortical lobes in the 3D Brain Viewer.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg border border-ne-cyan/30 bg-ne-cyan/10 px-3 py-2 text-xs font-medium text-ne-cyan hover:bg-ne-cyan/20"
            >
              Open 3D Brain Explorer
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative grid gap-5 xl:grid-cols-[1fr_310px]">
        <div className="space-y-5">
          {/* Active Session Overview + Instant Purge */}
          <Panel
            title="Screening overview"
            eyebrow={`${recording.recording_name} · local session`}
            actions={
              <button
                type="button"
                disabled={purging}
                onClick={handlePurgeSession}
                title="End session and permanently delete this recording and its derived events from local storage"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ne-critical/30 bg-ne-critical/10 px-2.5 py-1.5 text-xs font-medium text-ne-critical transition-colors hover:bg-ne-critical/20 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {purging ? "Purging..." : "End & Purge"}
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Recording", recording.recording_name],
                ["Model", `NeuroEdge ${EDGE_MODEL.format}`],
                ["Signal quality", `${qLabel} · ${qScore}%`],
                [
                  "Duration",
                  `${formatMMSS(recording.duration)} · ${recording.channel_count} ch`,
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
                    ? "Running on-device DSP & MLP inference…"
                    : "On-device screening complete"}
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

          {/* Screening Result Summary (includes Abstain / Poor Signal state) */}
          <Panel
            title="Screening result"
            eyebrow="Automated triage summary"
            actions={
              <InfoHelp title="Scoring & Abstention">
                <p>
                  Each 2-second window (512 samples at 256 Hz) is scored by the
                  local MLP using 28 DSP features and a 5-window trailing mean.
                </p>
                <p>
                  When electrode contact drops, traces saturate, or blinks
                  corrupt borderline windows, the model explicitly{" "}
                  <strong>abstains</strong> instead of outputting a forced
                  prediction.
                </p>
              </InfoHelp>
            }
          >
            <div
              className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                isPoorOverall
                  ? "border-rose-400/35 bg-rose-500/10"
                  : szCount > 0 || iedCount > 0
                    ? "border-ne-amber/30 bg-ne-amber/10"
                    : "border-ne-emerald/30 bg-ne-emerald/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {isPoorOverall ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-400" />
                ) : (
                  <CircleAlert className="mt-0.5 h-5 w-5 text-ne-amber" />
                )}
                <div>
                  <p className="font-medium text-ne-fg">
                    {isPoorOverall
                      ? "Inconclusive — poor signal quality (manual review needed)"
                      : szCount > 0 || iedCount > 0
                        ? "Candidate epileptiform activity flagged"
                        : abstainCount > 0
                          ? "Abstained on unreliable segments — manual check advised"
                          : "No epileptiform candidates above operating threshold"}
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-ne-fg-2">
                    {iedCount} IED candidate(s), {szCount} suspected seizure
                    segment(s), {abstainCount} abstained segment(s), and{" "}
                    {artCount} gated artifact(s) at threshold{" "}
                    {(
                      Number(session?.preprocessing_config?.threshold) ||
                      policy.operatingThreshold
                    ).toFixed(2)}
                    .
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                  isPoorOverall
                    ? "border-rose-400/40 text-rose-400"
                    : "border-ne-amber/30 text-ne-amber"
                }`}
              >
                {isPoorOverall
                  ? "ABSTAINED"
                  : szCount > 0 || iedCount > 0 || abstainCount > 0
                    ? "REVIEW REQUIRED"
                    : "SCREENED"}
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
                {abstainCount} abstained (unreliable)
              </span>
              <span className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1">
                {artCount} artifact gated
              </span>
            </div>
          </Panel>

          {/* Interactive Timeline & Event List */}
          <Panel
            title="Event timeline"
            eyebrow="Select a marker to inspect channels and review status"
            actions={
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/workspace?recording=${recording.id}${
                      selected ? `&start=${Math.floor(selected.seconds)}` : ""
                    }`,
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-ne-line px-2.5 py-1.5 text-xs text-ne-fg-2 hover:border-ne-cyan hover:text-ne-fg"
              >
                <Play className="h-3 w-3" />
                Inspect trace
              </button>
            }
          >
            <div className="mb-4 flex items-center justify-between text-xs text-ne-fg-3">
              <span>00:00</span>
              <span className="font-mono text-ne-cyan">
                Selected: {selected?.time ?? "00:00.00"}
              </span>
              <span>{formatMMSS(totalDur)}</span>
            </div>
            <div className="relative h-14 rounded-lg border border-ne-line bg-ne-bg2">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ne-line" />
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`Inspect ${event.kind} at ${event.time}`}
                  onClick={() => {
                    setSelected(event);
                    setReviewStatus(event.reviewState);
                    setNote(event.note ?? "");
                  }}
                  className={`absolute top-1/2 h-9 w-2 -translate-y-1/2 rounded-full transition-transform hover:scale-125 ${
                    event.kind === "Inconclusive / Abstain"
                      ? "bg-rose-400"
                      : event.kind === "Artifact"
                        ? "bg-ne-critical"
                        : event.kind === "Suspected seizure"
                          ? "bg-ne-ai"
                          : event.kind === "IED candidate"
                            ? "bg-ne-amber"
                            : "bg-ne-cyan"
                  } ${
                    selected?.id === event.id
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
                IED candidate
              </span>
              <span>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-ai" />
                Suspected seizure
              </span>
              <span>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-400" />
                Abstained / unreliable
              </span>
              <span>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-critical" />
                Artifact
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    setSelected(event);
                    setReviewStatus(event.reviewState);
                    setNote(event.note ?? "");
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected?.id === event.id
                      ? "border-ne-cyan/50 bg-ne-cyan/5"
                      : "border-ne-line bg-ne-bg2 hover:border-ne-cyan/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
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
                  <div className="flex items-center gap-2">
                    <span className="hidden font-mono text-[10px] text-ne-fg-3 md:inline">
                      {event.confidenceTier}
                    </span>
                    <ChevronRight className="h-4 w-4 text-ne-fg-3" />
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* Sticky Human Review Inspector */}
        {selected && (
          <Panel
            title="Event details"
            eyebrow={`Reviewer: ${policy.reviewerName}`}
            className="sticky top-[62px] h-fit"
          >
            <div className="space-y-4">
              <div
                className={`rounded-lg border p-3 ${statusTone(selected.kind)}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {selected.kind === "Inconclusive / Abstain" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {selected.kind}
                </div>
                <p className="mt-1 text-[11px] opacity-85">
                  {selected.confidenceDetail}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Timestamp", selected.time],
                  ["Duration", selected.duration],
                  ["Channels", selected.channels],
                  ["Assessment", selected.confidenceTier],
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
                  Clinician determination
                </p>
                <div className="grid gap-2">
                  <button
                    type="button"
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
                    type="button"
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
                    type="button"
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
                  placeholder="Record waveform morphology or context…"
                  className="min-h-24 w-full resize-y rounded-lg border border-ne-line bg-ne-bg2 p-3 text-xs text-ne-fg outline-none placeholder:text-ne-fg-3 focus:border-ne-cyan"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-2 text-xs text-ne-emerald hover:bg-ne-emerald/20"
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                  {noteSaved ? "Saved locally" : "Save note"}
                </button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}