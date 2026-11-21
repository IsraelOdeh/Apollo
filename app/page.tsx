// app/page.tsx
"use client";

import {
  Activity,
  AudioWaveform,
  BookOpen,
  Brain,
  ClipboardCheck,
  Cloud,
  ScanSearch,
  ShieldCheck,
  Stethoscope,
  Zap,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScreeningOverviewPanel } from "@/components/dashboard/screening-overview-panel";
import BrainViewer from "@/components/brain/BrainViewer";
import { Panel } from "@/components/layout/panel";
import { db } from "@/lib/storage/db";
import { useWorkstationPolicy } from "@/lib/privacy/workstation-policy";

function dailyBuckets(values: Date[], days = 7) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end);
    day.setDate(end.getDate() - (days - index - 1));
    day.setHours(0, 0, 0, 0);

    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    return values.filter((value) => {
      const timestamp = new Date(value).getTime();
      return timestamp >= day.getTime() && timestamp < nextDay.getTime();
    }).length;
  });
}

// Plain-language EEG rhythm bands displayed in Education view
const BRAIN_RHYTHMS = [
  {
    band: "Delta (0.5–4 Hz)",
    meaning: "Deep restorative sleep; focal delta during wakefulness can signal localized slowing.",
  },
  {
    band: "Theta (4–8 Hz)",
    meaning: "Drowsiness and memory processing; rhythmic temporal theta buildup can appear during focal seizures.",
  },
  {
    band: "Alpha (8–12 Hz)",
    meaning: "Calm wakefulness with eyes closed, strongest at occipital sensors (O1, O2).",
  },
  {
    band: "Beta (13–30 Hz)",
    meaning: "Active thinking, alertness, and motor preparation over frontal and central cortex.",
  },
  {
    band: "Gamma (30–45 Hz)",
    meaning: "High-frequency cortical processing; scalp recordings here are also sensitive to jaw/muscle tension.",
  },
] as const;

export default function OverviewPage() {
  const { policy, updatePolicy } = useWorkstationPolicy();
  const isEducation = policy.role === "education";

  const metrics = useLiveQuery(async () => {
    const [recordings, sessions, events, syncQueue] = await Promise.all([
      db.recordings.toArray(),
      db.screening_sessions.toArray(),
      db.detected_events.toArray(),
      db.sync_queue.toArray(),
    ]);

    const completedSessions = sessions.filter(
      (session) => session.status === "completed",
    );
    const candidateEvents = events.filter(
      (event) =>
        event.event_type === "ied_candidate" ||
        event.event_type === "seizure_candidate",
    );
    const pendingCandidates = candidateEvents.filter(
      (event) => event.review_status === "pending",
    );
    const recordingsRequiringReview = new Set(
      recordings
        .filter(
          (recording) =>
            recording.screening_status === "review_pending" ||
            recording.quality_status === "review_required",
        )
        .map((recording) => recording.id),
    ).size;

    const queuedItems = syncQueue.filter(
      (item) => item.status === "pending" || item.status === "syncing",
    ).length;
    const failedItems = syncQueue.filter((item) => item.status === "failed").length;
    const syncedItems = syncQueue.filter((item) => item.status === "synced").length;
    const syncPercent =
      syncQueue.length === 0 ? 100 : (syncedItems / syncQueue.length) * 100;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRecordings = recordings.filter(
      (recording) => new Date(recording.imported_at) >= sevenDaysAgo,
    ).length;

    return {
      recordingCount: recordings.length,
      completedScreenings: completedSessions.length,
      candidateCount: candidateEvents.length,
      pendingCandidateCount: pendingCandidates.length,
      reviewCount: recordingsRequiringReview,
      lowQualityCount: recordings.filter(
        (recording) => recording.quality_status === "poor",
      ).length,
      syncPercent,
      queuedItems,
      failedItems,
      recentRecordings,
      recordingSparkline: dailyBuckets(
        recordings.map((recording) => recording.imported_at),
      ),
      screeningSparkline: dailyBuckets(
        completedSessions.map(
          (session) => session.completed_at ?? session.started_at,
        ),
      ),
      candidateSparkline: dailyBuckets(
        candidateEvents.map((event) => event.created_at),
      ),
      reviewSparkline: dailyBuckets(
        recordings
          .filter(
            (recording) =>
              recording.screening_status === "review_pending" ||
              recording.quality_status === "review_required",
          )
          .map((recording) => recording.imported_at),
      ),
    };
  }, []);

  const data = metrics ?? {
    recordingCount: 0,
    completedScreenings: 0,
    candidateCount: 0,
    pendingCandidateCount: 0,
    reviewCount: 0,
    lowQualityCount: 0,
    syncPercent: 100,
    queuedItems: 0,
    failedItems: 0,
    recentRecordings: 0,
    recordingSparkline: [0, 0, 0, 0, 0, 0, 0],
    screeningSparkline: [0, 0, 0, 0, 0, 0, 0],
    candidateSparkline: [0, 0, 0, 0, 0, 0, 0],
    reviewSparkline: [0, 0, 0, 0, 0, 0, 0],
  };

  // Caregiver / Education Overview: interactive 3D brain + plain-language learning cards (no raw triage KPIs)
  if (isEducation) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ne-cyan/30 bg-ne-cyan/5 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 shrink-0 text-ne-cyan" />
            <div>
              <p className="text-sm font-semibold text-ne-fg">
                Caregiver &amp; Neurophysiology Education View
              </p>
              <p className="text-xs text-ne-fg-2">
                Click any lobe or 10-20 electrode on the 3D brain below to learn
                what each cortical region controls. Clinical triage queues are
                hidden in this mode.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updatePolicy({ role: "clinician" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-1.5 text-xs font-medium text-ne-emerald hover:bg-ne-emerald/20"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Switch to Clinical view
          </button>
        </div>

        <BrainViewer glow={0.25} defaultMode="overview" />

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel
            title="EEG Frequency Bands"
            eyebrow="Brain rhythms explained"
            actions={<Activity className="h-4 w-4 text-ne-cyan" />}
          >
            <ul className="space-y-2.5 text-xs leading-5">
              {BRAIN_RHYTHMS.map((item) => (
                <li
                  key={item.band}
                  className="rounded-lg border border-ne-line bg-ne-bg2 p-2.5"
                >
                  <p className="font-mono font-semibold text-ne-fg">
                    {item.band}
                  </p>
                  <p className="mt-0.5 text-ne-fg-2">{item.meaning}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="How 10-20 Scalp Sensors Work"
            eyebrow="Electrode naming guide"
            actions={<Brain className="h-4 w-4 text-ne-emerald" />}
          >
            <div className="space-y-3 text-xs leading-5 text-ne-fg-2">
              <div className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
                <p className="font-semibold text-ne-fg">Letters = Brain Lobe</p>
                <p className="mt-1">
                  <strong>Fp</strong> (Frontopolar), <strong>F</strong> (Frontal),{" "}
                  <strong>C</strong> (Central), <strong>T</strong> (Temporal),{" "}
                  <strong>P</strong> (Parietal), and <strong>O</strong> (Occipital).
                </p>
              </div>
              <div className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
                <p className="font-semibold text-ne-fg">Numbers = Hemisphere</p>
                <p className="mt-1">
                  <strong>Odd numbers</strong> (1, 3, 5, 7) sit on the left side;{" "}
                  <strong>even numbers</strong> (2, 4, 6, 8) sit on the right;{" "}
                  <strong>z</strong> runs down the midline.
                </p>
              </div>
              <div className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
                <p className="font-semibold text-ne-fg">
                  Why Blinks &amp; Movement Matter
                </p>
                <p className="mt-1">
                  Eye blinks (Fp1/Fp2) and jaw clenching create large electrical
                  signals that can mask brainwaves, so NeuroEdge flags noisy
                  segments instead of guessing.
                </p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Seizure Observation & Safety"
            eyebrow="Caregiver reference"
            actions={<ShieldCheck className="h-4 w-4 text-ne-amber" />}
          >
            <ul className="space-y-2.5 text-xs leading-5 text-ne-fg-2">
              <li className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
                <strong className="text-ne-fg">Time the event:</strong> Note the
                exact start time and duration. Seek emergency care if a seizure
                lasts 5 minutes or longer.
              </li>
              <li className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
                <strong className="text-ne-fg">Keep the person safe:</strong>{" "}
                Clear hard objects, cushion the head, and gently turn them onto
                their side once movements slow. Never place objects in the mouth.
              </li>
              <li className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
                <strong className="text-ne-fg">Note what you saw:</strong>{" "}
                Record staring spells, rhythmic jerking, or confusion afterwards
                to share with a qualified clinician.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    );
  }

  // Clinical Overview: 3D brain + screening telemetry chart + 5 live KPI cards
  const kpis = [
    {
      id: "recordings",
      label: "EEG Recordings",
      value: data.recordingCount.toLocaleString(),
      trend: `${data.recentRecordings} imported in 7 days`,
      tone: "positive" as const,
      icon: AudioWaveform,
      color: "#42D9F5",
      sparkline: data.recordingSparkline,
    },
    {
      id: "screenings",
      label: "Screenings Completed",
      value: data.completedScreenings.toLocaleString(),
      trend:
        data.recordingCount === 0
          ? "0% of recordings"
          : `${Math.round((data.completedScreenings / data.recordingCount) * 100)}% of recordings`,
      tone: "neutral" as const,
      icon: ScanSearch,
      color: "#36E0A1",
      sparkline: data.screeningSparkline,
    },
    {
      id: "candidates",
      label: "Candidate Events",
      value: data.candidateCount.toLocaleString(),
      trend: `${data.pendingCandidateCount} awaiting clinician review`,
      tone:
        data.pendingCandidateCount > 0
          ? ("warning" as const)
          : ("positive" as const),
      icon: Zap,
      color: "#F6BD60",
      sparkline: data.candidateSparkline,
    },
    {
      id: "review",
      label: "Recordings Requiring Review",
      value: data.reviewCount.toLocaleString(),
      trend: `${data.lowQualityCount} flagged as low quality`,
      tone:
        data.reviewCount > 0 ? ("warning" as const) : ("positive" as const),
      icon: ClipboardCheck,
      color: "#9D85FF",
      sparkline: data.reviewSparkline,
    },
    {
      id: "sync",
      label: "Local-Only Storage",
      value: policy.localOnlyMode ? "100%" : `${data.syncPercent.toFixed(1)}%`,
      trend: policy.localOnlyMode
        ? "Sync OFF · Zero outbound EEG"
        : `${data.queuedItems} queued · ${data.failedItems} failed`,
      tone: data.failedItems > 0 ? ("warning" as const) : ("neutral" as const),
      icon: Cloud,
      color: "#36E0A1",
      sparkline:
        data.syncPercent === 100
          ? [100, 100, 100, 100, 100, 100, 100]
          : [
              100,
              100,
              100,
              100,
              data.syncPercent,
              data.syncPercent,
              data.syncPercent,
            ],
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <BrainViewer glow={0.25} />
      <ScreeningOverviewPanel />
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>
    </div>
  );
}