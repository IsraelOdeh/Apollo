// components/neuroedge/reports-page.tsx
"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Activity,
  BadgeCheck,
  ChartNoAxesColumn,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  History,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { db } from "@/lib/storage/db";
import { Panel } from "@/components/layout/panel";

type ReportRow = {
  id: string;
  date: string;
  dateTimestamp: number;
  screened: number;
  candidates: number;
  quality: string;
  confirmed: number;
};

function qualityLabel(status: string) {
  if (status === "good") return "Good";
  if (status === "poor") return "Limited";
  if (status === "review_required") return "Fair";
  return "Unknown";
}

function formatReportDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function ActionButton({
  children,
  onClick,
  quiet = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        quiet
          ? "border-ne-line bg-ne-bg2 text-ne-fg-2 hover:text-ne-fg"
          : "border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald hover:bg-ne-emerald/20"
      }`}
    >
      {children}
    </button>
  );
}

export function ReportsPage() {
  // Live IndexedDB aggregation across local recordings, sessions, events, and clinician annotations
  const reportData = useLiveQuery(async () => {
    const [recordings, sessions, events, annotations] = await Promise.all([
      db.recordings.toArray(),
      db.screening_sessions.toArray(),
      db.detected_events.toArray(),
      db.annotations.toArray(),
    ]);

    const sessionRows: ReportRow[] = recordings.map((recording) => {
      const recordingSessions = sessions.filter(
        (session) => session.recording_id === recording.id,
      );
      const sessionIds = new Set(
        recordingSessions.map((session) => session.id),
      );
      const recordingEvents = events.filter((event) =>
        sessionIds.has(event.session_id),
      );
      const eventIds = new Set(recordingEvents.map((event) => event.id));
      const confirmed = annotations.filter(
        (annotation) =>
          eventIds.has(annotation.event_id) &&
          annotation.annotation_type === "accepted",
      ).length;

      const latestSession = [...recordingSessions].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      )[0];

      return {
        id: recording.id,
        date: formatReportDate(
          latestSession?.started_at ??
            recording.recording_date ??
            recording.imported_at,
        ),
        dateTimestamp: new Date(
          latestSession?.started_at ??
            recording.recording_date ??
            recording.imported_at,
        ).getTime(),
        screened: Math.max(1, Math.ceil(recording.duration / 10)),
        candidates: recordingEvents.filter(
          (event) =>
            event.event_type === "ied_candidate" ||
            event.event_type === "seizure_candidate",
        ).length,
        quality: qualityLabel(recording.quality_status),
        confirmed,
      };
    });

    const completedSessions = sessions.filter(
      (session) => session.status === "completed",
    );
    const candidateEvents = events.filter(
      (event) =>
        event.event_type === "ied_candidate" ||
        event.event_type === "seizure_candidate",
    );
    const artifactEvents = events.filter(
      (event) => event.event_type === "artifact",
    );
    const abstainEvents = events.filter(
      (event) => event.event_type === "abstain_unreliable",
    );
    const reviewEvents = events.filter(
      (event) =>
        event.review_status === "pending" ||
        event.review_status === "uncertain",
    );

    const qualityCounts = {
      Good: recordings.filter(
        (recording) => recording.quality_status === "good",
      ).length,
      Fair: recordings.filter(
        (recording) => recording.quality_status === "review_required",
      ).length,
      Limited: recordings.filter(
        (recording) => recording.quality_status === "poor",
      ).length,
    };

    const annotationRows = recordings
      .map((recording) => {
        const recordingSessions = sessions.filter(
          (session) => session.recording_id === recording.id,
        );
        const sessionIds = new Set(
          recordingSessions.map((session) => session.id),
        );
        const recordingEvents = events.filter((event) =>
          sessionIds.has(event.session_id),
        );
        const eventIds = new Set(recordingEvents.map((event) => event.id));
        const recordingAnnotations = annotations.filter((annotation) =>
          eventIds.has(annotation.event_id),
        );
        const findingCount = recordingEvents.filter(
          (event) =>
            event.event_type !== "artifact" &&
            event.event_type !== "abstain_unreliable",
        ).length;

        return {
          id: recording.id,
          finding: `Candidates × ${findingCount}`,
          note: `${recordingAnnotations.length} annotation${
            recordingAnnotations.length === 1 ? "" : "s"
          }`,
          status:
            recordingAnnotations.length === 0
              ? "Pending"
              : recordingAnnotations.some(
                    (annotation) => annotation.annotation_type === "uncertain",
                  )
                ? "Partial"
                : "Reviewed",
        };
      })
      .filter(
        (row) => row.status !== "Pending" || row.finding !== "Candidates × 0",
      );

    const latestSortedSessions = [...sessions].sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );

    return {
      rows: sessionRows,
      annotationRows,
      sessions: completedSessions.length,
      candidates: candidateEvents.length,
      artifacts: artifactEvents.length,
      abstained: abstainEvents.length,
      reviewNeeded: reviewEvents.length,
      annotations: annotations.length,
      qualityCounts,
      acceptedAnnotations: annotations.filter(
        (annotation) => annotation.annotation_type === "accepted",
      ).length,
      rejectedAnnotations: annotations.filter(
        (annotation) => annotation.annotation_type === "rejected",
      ).length,
      uncertainAnnotations: annotations.filter(
        (annotation) => annotation.annotation_type === "uncertain",
      ).length,
      modelVersion: latestSortedSessions[0]?.model_version ?? "No model run",
      pipelineConfig: latestSortedSessions[0]?.preprocessing_config ?? {},
      goodQualityPercent:
        recordings.length === 0
          ? 0
          : Math.round(
              ((qualityCounts.Good + qualityCounts.Fair) / recordings.length) *
                100,
            ),
      sessionsWithCandidates: new Set(
        candidateEvents.map((event) => event.session_id),
      ).size,
    };
  }, []);

  const [range, setRange] = useState("Last 30 days");
  const [qualityFilter, setQualityFilter] = useState("All quality");
  const [pendingExport, setPendingExport] = useState<"csv" | "pdf" | null>(
    null,
  );

  const rows = reportData?.rows ?? [];
  const filtered = useMemo(() => {
    const cutoff =
      range === "Last 7 days"
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : range === "Last 30 days"
          ? Date.now() - 30 * 24 * 60 * 60 * 1000
          : 0;

    return rows.filter(
      (row) =>
        row.dateTimestamp >= cutoff &&
        (qualityFilter === "All quality" || row.quality === qualityFilter),
    );
  }, [qualityFilter, range, rows]);

  const candidateCount = reportData?.candidates ?? 0;
  const pipelineConfig = (reportData?.pipelineConfig ?? {}) as Record<
    string,
    unknown
  >;
  const artifactCount = reportData?.artifacts ?? 0;
  const abstainedCount = reportData?.abstained ?? 0;
  const reviewCount = reportData?.reviewNeeded ?? 0;
  const distributionTotal =
    candidateCount + artifactCount + abstainedCount + reviewCount;

  const distribution = [
    {
      name: "Candidate events",
      count: candidateCount,
      color: "bg-ne-ai",
      note: "Seizure / IED",
    },
    {
      name: "Abstained (unreliable)",
      count: abstainedCount,
      color: "bg-rose-400",
      note: "Poor contact / ambiguous",
    },
    {
      name: "Artifact gated",
      count: artifactCount,
      color: "bg-ne-amber",
      note: "Ocular / EMG",
    },
    {
      name: "Review pending",
      count: reviewCount,
      color: "bg-ne-cyan",
      note: "Awaiting reviewer",
    },
  ];

  // Build pseudonymous CSV payload (excludes raw waveforms and patient identifiers)
  const csv = useMemo(() => {
    const header = [
      "recording_id",
      "date",
      "screened_segments",
      "model_candidates",
      "recording_quality",
      "human_confirmed_annotations",
    ];
    return [
      header.join(","),
      ...filtered.map((row) =>
        [
          row.id,
          `"${row.date}"`,
          row.screened,
          row.candidates,
          row.quality,
          row.confirmed,
        ].join(","),
      ),
    ].join("\n");
  }, [filtered]);

  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neuroedge-screening-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Executes export only after explicit operator review of included vs. excluded fields
  const confirmExport = () => {
    if (pendingExport === "csv") {
      exportCsv();
    } else if (pendingExport === "pdf") {
      window.print();
    }
    setPendingExport(null);
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Period Selector & Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ne-line bg-ne-card/70 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ne-fg-2">
          <span className="font-mono uppercase tracking-wider text-ne-fg-3">
            Report period
          </span>
          <select
            aria-label="Report period"
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-xs text-ne-fg outline-none focus:border-ne-cyan"
          >
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>All sessions</option>
          </select>
          <span className="hidden text-ne-fg-3 sm:inline">
            Updated{" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
              new Date(),
            )}{" "}
            · Local IndexedDB data
          </span>
        </div>
        <div className="flex gap-2">
          <ActionButton quiet onClick={() => setPendingExport("pdf")}>
            <FileText className="size-3.5" />
            Export PDF
          </ActionButton>
          <ActionButton onClick={() => setPendingExport("csv")}>
            <FileSpreadsheet className="size-3.5" />
            Export CSV
          </ActionButton>
        </div>
      </div>

      {/* Pre-Export Derived-Artefact Privacy Review */}
      {pendingExport && (
        <div
          role="dialog"
          aria-label="Pre-export privacy review"
          className="rounded-xl border border-ne-cyan/40 bg-ne-card p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ne-fg">
              <ShieldCheck className="size-4 text-ne-cyan" />
              Pre-export artefact review ({pendingExport.toUpperCase()})
            </div>
            <button
              type="button"
              onClick={() => setPendingExport(null)}
              className="rounded p-1 text-ne-fg-3 hover:text-ne-fg"
              aria-label="Cancel export"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ne-emerald">
                Included in export ({filtered.length} session row
                {filtered.length === 1 ? "" : "s"})
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ne-fg-2">
                <li>Pseudonymous session ID &amp; recording date</li>
                <li>Screened segment count &amp; signal quality tier</li>
                <li>Model candidate counts &amp; clinician review totals</li>
              </ul>
            </div>
            <div className="rounded-lg border border-ne-line bg-ne-bg2 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ne-cyan">
                Excluded from export
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ne-fg-2">
                <li>Raw EDF / EDF+ waveform traces</li>
                <li>Patient names, contact info, or hospital IDs</li>
                <li>Hardware serial numbers or browser metadata</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] text-ne-fg-3">
              <Lock className="size-3.5 text-ne-amber" />
              Derived EEG outputs retain a traceable neural origin — share only
              with authorized recipients.
            </p>
            <div className="flex gap-2">
              <ActionButton quiet onClick={() => setPendingExport(null)}>
                Cancel
              </ActionButton>
              <ActionButton onClick={confirmExport}>
                <Download className="size-3.5" />
                Confirm {pendingExport.toUpperCase()} export
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Top KPI Strip */}
      <section
        aria-label="Screening summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Sessions screened",
            value: String(reportData?.sessions ?? 0),
            sub: "Across selected period",
            icon: Activity,
            tone: "text-ne-cyan",
          },
          {
            label: "Model candidates",
            value: String(candidateCount),
            sub: "Require clinician review",
            icon: CircleAlert,
            tone: "text-ne-ai",
          },
          {
            label: "Review completed",
            value: String(reportData?.annotations ?? 0),
            sub: "Human annotations",
            icon: BadgeCheck,
            tone: "text-ne-emerald",
          },
          {
            label: "Recording quality",
            value: `${reportData?.goodQualityPercent ?? 0}%`,
            sub: "Good or acceptable",
            icon: Gauge,
            tone: "text-ne-amber",
          },
        ].map(({ label, value, sub, icon: Icon, tone }) => (
          <article
            key={label}
            className="rounded-xl border border-ne-line bg-ne-card/90 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-ne-fg-2">{label}</span>
              <Icon className={`size-4 ${tone}`} />
            </div>
            <p className="mt-3 font-mono text-2xl font-medium tracking-tight text-ne-fg">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-ne-fg-3">{sub}</p>
          </article>
        ))}
      </section>

      {/* Summary & Distribution */}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Screening summary"
          eyebrow={`Model output · ${reportData?.sessions ?? 0} sessions`}
          actions={
            <span className="rounded-full border border-ne-ai/20 bg-ne-ai/10 px-2.5 py-1 font-mono text-[10px] text-ne-ai">
              TRIAGE ESTIMATES
            </span>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [String(candidateCount), "Candidate events", "Across recordings"],
              [
                String(reportData?.sessionsWithCandidates ?? 0),
                "Sessions with candidates",
                "Flagged for review",
              ],
              [
                String(reportData?.annotations ?? 0),
                "Human annotations",
                "Recorded separately",
              ],
            ].map(([value, label, detail]) => (
              <div
                key={label}
                className="rounded-lg border border-ne-line bg-ne-bg2 p-3"
              >
                <p className="font-mono text-xl text-ne-fg">{value}</p>
                <p className="mt-1 text-xs text-ne-fg-2">{label}</p>
                <p className="mt-1 text-[10px] text-ne-fg-3">{detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Event distribution"
          eyebrow={`${distributionTotal} total · including abstentions`}
        >
          <div
            className="flex h-3 overflow-hidden rounded-full bg-ne-elevated"
            role="img"
            aria-label={`Event distribution: ${candidateCount} candidates, ${abstainedCount} abstained, ${artifactCount} artifacts, ${reviewCount} pending`}
          >
            {distribution.map((item) => (
              <div
                key={item.name}
                className={item.color}
                style={{
                  width: `${
                    distributionTotal === 0
                      ? 0
                      : (item.count / distributionTotal) * 100
                  }%`,
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {distribution.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <span
                  className={`size-2.5 shrink-0 rounded-sm ${item.color}`}
                />
                <span className="min-w-0 flex-1 text-xs text-ne-fg-2">
                  {item.name}
                  <span className="ml-2 text-[10px] text-ne-fg-3">
                    {item.note}
                  </span>
                </span>
                <span className="font-mono text-xs text-ne-fg">
                  {item.count}
                </span>
                <span className="w-9 text-right font-mono text-[10px] text-ne-fg-3">
                  {distributionTotal === 0
                    ? 0
                    : Math.round((item.count / distributionTotal) * 100)}
                  %
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Quality & Clinician Review Breakdown */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Recording quality summary" eyebrow="Signal integrity">
          <div className="grid grid-cols-3 gap-2">
            {[
              [
                "Good",
                String(reportData?.qualityCounts?.Good ?? 0),
                "text-ne-emerald",
                "bg-ne-emerald",
              ],
              [
                "Fair",
                String(reportData?.qualityCounts?.Fair ?? 0),
                "text-ne-amber",
                "bg-ne-amber",
              ],
              [
                "Limited",
                String(reportData?.qualityCounts?.Limited ?? 0),
                "text-ne-critical",
                "bg-ne-critical",
              ],
            ].map(([label, value, text, bar]) => (
              <div
                key={label}
                className="rounded-lg border border-ne-line bg-ne-bg2 p-3"
              >
                <p className={`text-[11px] ${text}`}>{label}</p>
                <p className="mt-2 font-mono text-xl text-ne-fg">{value}</p>
                <div className="mt-3 h-1 overflow-hidden rounded bg-ne-elevated">
                  <div
                    className={`h-full ${bar}`}
                    style={{
                      width: `${
                        rows.length === 0
                          ? 0
                          : (Number(value) / rows.length) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-ne-fg-3">
            Quality reflects scalp electrode contact and artifact ratio during
            local screening.
          </p>
        </Panel>

        <Panel
          title="Clinician review metrics"
          eyebrow={`Local review activity · ${reportData?.modelVersion ?? "No model run"}`}
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              [
                "Accepted",
                String(reportData?.acceptedAnnotations ?? 0),
                "Confirmed events",
              ],
              [
                "Rejected",
                String(reportData?.rejectedAnnotations ?? 0),
                "Dismissed flags",
              ],
              [
                "Uncertain",
                String(reportData?.uncertainAnnotations ?? 0),
                "Needs follow-up",
              ],
              [
                "Annotations",
                String(reportData?.annotations ?? 0),
                "Total logged",
              ],
            ].map(([label, value, detail]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-2 rounded-lg border border-ne-line bg-ne-bg2 p-3"
              >
                <div>
                  <p className="text-[11px] text-ne-fg-2">{label}</p>
                  <p className="mt-1 text-[9px] text-ne-fg-3">{detail}</p>
                </div>
                <span className="font-mono text-lg text-ne-cyan">{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Pipeline Parameters & Annotation Audit Trail */}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          title="Signal-processing configuration"
          eyebrow="Applied screening pipeline"
          actions={<SlidersHorizontal className="size-4 text-ne-fg-3" />}
        >
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {[
              [
                "High-pass",
                pipelineConfig.highPassHz == null
                  ? "Off"
                  : `${pipelineConfig.highPassHz} Hz`,
              ],
              [
                "Low-pass",
                pipelineConfig.lowPassHz == null
                  ? "Off"
                  : `${pipelineConfig.lowPassHz} Hz`,
              ],
              [
                "Notch",
                pipelineConfig.notchHz == null
                  ? "Off"
                  : `${pipelineConfig.notchHz} Hz`,
              ],
              ["Montage", String(pipelineConfig.montage ?? "Referential")],
              [
                "Sampling",
                String(
                  pipelineConfig.samplingRateHz
                    ? `${pipelineConfig.samplingRateHz} Hz`
                    : "Recording native",
                ),
              ],
              [
                "Threshold",
                pipelineConfig.threshold != null
                  ? Number(pipelineConfig.threshold).toFixed(2)
                  : "0.69",
              ],
            ].map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 border-b border-ne-line/70 pb-2"
              >
                <span className="text-[11px] text-ne-fg-3">{key}</span>
                <span className="font-mono text-[10px] text-ne-fg-2">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-ne-fg-3">
            Source EDF files remain unmodified in local browser storage.
          </p>
        </Panel>

        <Panel
          title="Annotation history"
          eyebrow="Human-reviewed activity"
          actions={
            <span className="inline-flex items-center gap-1 text-[10px] text-ne-fg-3">
              <History className="size-3" />
              Audit trail
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left">
              <thead>
                <tr className="border-b border-ne-line text-[9px] uppercase tracking-wider text-ne-fg-3">
                  <th className="pb-2 font-medium">Recording</th>
                  <th className="pb-2 font-medium">Model estimate</th>
                  <th className="pb-2 font-medium">Human annotation</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(reportData?.annotationRows ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-ne-line/60 last:border-0"
                  >
                    <td className="py-3 font-mono text-[10px] text-ne-cyan">
                      {row.id}
                    </td>
                    <td className="py-3 text-[10px] text-ne-ai">
                      {row.finding}
                    </td>
                    <td className="py-3 text-[10px] text-ne-fg-2">
                      {row.note}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] ${
                          row.status === "Reviewed"
                            ? "bg-ne-emerald/10 text-ne-emerald"
                            : "bg-ne-amber/10 text-ne-amber"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-ne-fg-3">
            <ChartNoAxesColumn className="size-3.5 text-ne-ai" />
            <span>Model estimates</span>
            <span className="ml-2 size-1 rounded-full bg-ne-emerald" />
            <span>Human annotations stored separately</span>
          </div>
        </Panel>
      </div>

      {/* Session Records Table */}
      <Panel
        title="Screening session records"
        eyebrow={`${filtered.length} pseudonymous sessions`}
        actions={
          <label className="flex items-center gap-2 text-[10px] text-ne-fg-3">
            <Filter className="size-3" />
            <select
              aria-label="Filter by recording quality"
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value)}
              className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1.5 text-[10px] text-ne-fg"
            >
              <option>All quality</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Limited</option>
            </select>
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-ne-line text-[9px] uppercase tracking-wider text-ne-fg-3">
                <th className="pb-3 font-medium">Recording ID</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 text-right font-medium">Segments</th>
                <th className="pb-3 text-right font-medium">
                  Model candidates
                </th>
                <th className="pb-3 text-right font-medium">
                  Recording quality
                </th>
                <th className="pb-3 text-right font-medium">Human reviewed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ne-line/60 last:border-0"
                >
                  <td className="py-3 font-mono text-[11px] text-ne-cyan">
                    {row.id}
                  </td>
                  <td className="py-3 text-[11px] text-ne-fg-2">{row.date}</td>
                  <td className="py-3 text-right font-mono text-[11px] text-ne-fg-2">
                    {row.screened}
                  </td>
                  <td className="py-3 text-right font-mono text-[11px] text-ne-ai">
                    {row.candidates}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] ${
                        row.quality === "Good"
                          ? "bg-ne-emerald/10 text-ne-emerald"
                          : row.quality === "Fair"
                            ? "bg-ne-amber/10 text-ne-amber"
                            : "bg-ne-critical/10 text-ne-critical"
                      }`}
                    >
                      {row.quality}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono text-[11px] text-ne-fg-2">
                    {row.confirmed} confirmed
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}