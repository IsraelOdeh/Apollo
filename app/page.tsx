// app/page.tsx
"use client";

import {
  AudioWaveform,
  ClipboardCheck,
  Cloud,
  ScanSearch,
  Zap,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScreeningOverviewPanel } from "@/components/dashboard/screening-overview-panel";
import BrainViewer from "@/components/brain/BrainViewer";
import { db } from "@/lib/storage/db";

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

export default function OverviewPage() {
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
      (event) => event.event_type === "ied_candidate",
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
    const syncPercent = syncQueue.length === 0
      ? 100
      : (syncedItems / syncQueue.length) * 100;

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
      recordingSparkline: dailyBuckets(recordings.map((recording) => recording.imported_at)),
      screeningSparkline: dailyBuckets(completedSessions.map((session) => session.completed_at ?? session.started_at)),
      candidateSparkline: dailyBuckets(candidateEvents.map((event) => event.created_at)),
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
      trend: data.recordingCount === 0
        ? "0% of recordings"
        : `${Math.round((data.completedScreenings / data.recordingCount) * 100)}% of recordings`,
      tone: "neutral" as const,
      icon: ScanSearch,
      color: "#36E0A1",
      sparkline: data.screeningSparkline,
    },
    {
      id: "candidates",
      label: "Candidate IED Events",
      value: data.candidateCount.toLocaleString(),
      trend: `${data.pendingCandidateCount} awaiting clinician review`,
      tone: data.pendingCandidateCount > 0 ? "warning" as const : "positive" as const,
      icon: Zap,
      color: "#F6BD60",
      sparkline: data.candidateSparkline,
    },
    {
      id: "review",
      label: "Recordings Requiring Review",
      value: data.reviewCount.toLocaleString(),
      trend: `${data.lowQualityCount} flagged as low quality`,
      tone: data.reviewCount > 0 ? "warning" as const : "positive" as const,
      icon: ClipboardCheck,
      color: "#9D85FF",
      sparkline: data.reviewSparkline,
    },
    {
      id: "sync",
      label: "Data Synchronization",
      value: `${data.syncPercent.toFixed(1)}%`,
      trend: `${data.queuedItems} queued · ${data.failedItems} failed`,
      tone: data.failedItems > 0 ? "warning" as const : "neutral" as const,
      icon: Cloud,
      color: "#36E0A1",
      sparkline: data.syncPercent === 100
        ? [100, 100, 100, 100, 100, 100, 100]
        : [100, 100, 100, 100, data.syncPercent, data.syncPercent, data.syncPercent],
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
