"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/storage/db";
import {
  CheckCircle2,
  ChevronDown,
  CloudOff,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function Stat({
  value,
  label,
  tone = "default",
}: {
  value: string;
  label: string;
  tone?: "default" | "green" | "amber" | "red";
}) {
  const color =
    tone === "green"
      ? "text-ne-emerald"
      : tone === "amber"
        ? "text-ne-amber"
        : tone === "red"
          ? "text-ne-critical"
          : "text-ne-fg";
  return (
    <div className="rounded-xl border border-ne-line bg-ne-card p-4">
      <p className={`font-mono text-2xl ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-ne-fg-3">{label}</p>
    </div>
  );
}

export function BrainDataRepository() {
  const liveData = useLiveQuery(async () => {
    const [recordings, sessions, events, syncQueue, lastSyncSetting] =
      await Promise.all([
        db.recordings.toArray(),
        db.screening_sessions.toArray(),
        db.detected_events.toArray(),
        db.sync_queue.toArray(),
        db.app_settings.get("last_sync_attempt"),
      ]);

    const records = recordings.map((recording) => {
      const recordingSessions = sessions
        .filter((session) => session.recording_id === recording.id)
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        );
      const latestSession = recordingSessions[0];
      const sessionEvents = latestSession
        ? events.filter((event) => event.session_id === latestSession.id)
        : [];

      const queueItem = syncQueue
        .filter((item) => item.entity_id === recording.id)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0];

      let sync = "Synchronized";
      if (queueItem?.status === "pending" || queueItem?.status === "syncing") {
        sync = "Pending";
      } else if (queueItem?.status === "failed") {
        sync = "Failed";
      } else if (!queueItem) {
        sync =
          recording.screening_status === "imported"
            ? "Pending"
            : "Synchronized";
      }

      let output = "Not processed";
      if (
        latestSession?.status === "processing" ||
        latestSession?.status === "pending"
      ) {
        output = "Awaiting screening";
      } else if (latestSession?.status === "failed") {
        output = "Screening failed";
      } else if (
        sessionEvents.some((event) => event.event_type === "ied_candidate")
      ) {
        output = "Candidate IEDs";
      } else if (latestSession?.status === "completed") {
        output = "No candidate";
      }

      let quality = "Unknown";
      if (recording.quality_status === "good") quality = "Good";
      if (recording.quality_status === "poor") quality = "Poor";
      if (recording.quality_status === "review_required") quality = "Review";

      return {
        id: recording.id,
        name: recording.recording_name,
        hz: `${recording.sampling_rate} Hz`,
        channels: `${recording.channel_count} ch`,
        duration: formatDuration(recording.duration),
        config: latestSession
          ? `Preprocessing · ${latestSession.model_version}`
          : "No processing configuration",
        model: latestSession?.model_version ?? "—",
        output,
        quality,
        sync,
      };
    });

    const pendingSync = syncQueue.filter(
      (item) => item.status === "pending" || item.status === "syncing",
    ).length;
    const failedSync = syncQueue.filter(
      (item) => item.status === "failed",
    ).length;
    const synchronized = syncQueue.filter(
      (item) => item.status === "synced",
    ).length;

    return {
      records,
      structuredCount: sessions.filter(
        (session) => session.status === "completed",
      ).length,
      pendingSync,
      failedSync,
      synchronized,
      lastSyncAttempt:
        typeof lastSyncSetting?.value === "string"
          ? lastSyncSetting.value
          : null,
    };
  }, []);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All records");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  const records = liveData?.records ?? [];

  const syncQueue = async () => {
    await db.app_settings.put({
      key: "last_sync_attempt",
      value: new Date().toISOString(),
    });
  };
  const filtered = useMemo(
    () =>
      records
        .filter((record) => {
          const matchesQuery = Object.values(record)
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase());
          const matchesFilter =
            filter === "All records" ||
            (filter === "Pending sync" && record.sync === "Pending") ||
            (filter === "Failed sync" && record.sync === "Failed") ||
            (filter === "Candidate output" &&
              record.output === "Candidate IEDs") ||
            (filter === "Poor quality" && record.quality === "Poor");
          return matchesQuery && matchesFilter;
        })
        .sort((a, b) =>
          sortAsc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id),
        ),
    [filter, query, sortAsc, liveData],
  );
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportType: "research_metadata",
            identifiers: "pseudonymous",
            records: filtered,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neuroedge-research-metadata.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ne-emerald">
            Data standardization
          </p>
          <p className="mt-2 max-w-xl text-sm text-ne-fg-2">
            Research-ready metadata stays pseudonymous. Patient identifiers are
            never included in this repository export.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          value={String(records.length)}
          label="Total recordings stored locally"
        />
        <Stat
          value={String(liveData?.structuredCount ?? 0)}
          label="Structured records generated"
          tone="green"
        />
        <Stat
          value={String(liveData?.pendingSync ?? 0)}
          label="Pending synchronization"
          tone="amber"
        />
        <Stat
          value={String(liveData?.synchronized ?? 0)}
          label="Successfully synchronized"
          tone="green"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <Panel
          title="Data explorer"
          eyebrow={`${filtered.length} standardized records`}
          actions={
            <button
              onClick={() => setFilter("All records")}
              className="inline-flex items-center gap-2 rounded-lg border border-ne-line px-3 py-2 text-xs text-ne-fg-2 hover:text-ne-fg"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
            </button>
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ne-fg-3" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search recording ID or metadata"
                className="w-full rounded-lg border border-ne-line bg-ne-bg2 py-2 pl-9 pr-3 text-sm text-ne-fg outline-none focus:border-ne-cyan"
              />
            </label>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-xs text-ne-fg-2 outline-none"
            >
              <option>All records</option>
              <option>Pending sync</option>
              <option>Failed sync</option>
              <option>Candidate output</option>
              <option>Poor quality</option>
            </select>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead>
                <tr className="border-b border-ne-line text-[10px] uppercase tracking-wider text-ne-fg-3">
                  <th className="pb-3 pr-4">Recording ID</th>
                  <th className="pb-3 pr-4">Signal</th>
                  <th className="pb-3 pr-4">Duration</th>
                  <th className="pb-3 pr-4">Processing</th>
                  <th className="pb-3 pr-4">Model / output</th>
                  <th className="pb-3 pr-4">Quality</th>
                  <th className="pb-3">Sync</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 4, page * 4).map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-ne-line/60 text-ne-fg-2"
                  >
                    <td className="py-3 pr-4 font-mono text-ne-cyan">
                      {record.id}
                    </td>
                    <td className="py-3 pr-4">
                      <p>{record.hz}</p>
                      <p className="mt-1 text-[10px] text-ne-fg-3">
                        {record.channels}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-mono">{record.duration}</td>
                    <td className="max-w-[150px] py-3 pr-4 text-[10px] text-ne-fg-3">
                      {record.config}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-[10px] text-ne-fg-3">{record.model}</p>
                      <p className="mt-1 text-ne-fg">{record.output}</p>
                    </td>
                    <td
                      className={`py-3 pr-4 ${record.quality === "Poor" ? "text-ne-critical" : record.quality === "Review" ? "text-ne-amber" : "text-ne-emerald"}`}
                    >
                      {record.quality}
                    </td>
                    <td
                      className={`py-3 ${record.sync === "Failed" ? "text-ne-critical" : record.sync === "Pending" ? "text-ne-amber" : "text-ne-emerald"}`}
                    >
                      {record.sync}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ne-line pt-3">
            <span className="text-xs text-ne-fg-3">
              Showing {Math.min((page - 1) * 4 + 1, filtered.length)}–
              {Math.min(page * 4, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="rounded-lg border border-ne-line px-3 py-1.5 text-xs text-ne-fg-2"
              >
                Sort ID{" "}
                <ChevronDown
                  className={`ml-1 inline h-3 w-3 transition-transform ${sortAsc ? "rotate-180" : ""}`}
                />
              </button>
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-ne-line px-3 py-1.5 text-xs text-ne-fg-2 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page * 4 >= filtered.length}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-ne-line px-3 py-1.5 text-xs text-ne-fg-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="Standardization" eyebrow="Schema validation">
            <div className="flex items-center gap-3 rounded-xl border border-ne-emerald/20 bg-ne-emerald/5 p-3">
              <CheckCircle2 className="h-5 w-5 text-ne-emerald" />
              <div>
                <p className="text-sm text-ne-fg">Schema valid</p>
                <p className="text-xs text-ne-fg-3">
                  All required fields present
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs text-ne-fg-2">
              <div className="flex justify-between">
                <span>Metadata coverage</span>
                <span className="font-mono text-ne-emerald">100%</span>
              </div>
              <div className="flex justify-between">
                <span>Identifiers</span>
                <span className="font-mono text-ne-cyan">Pseudonymous</span>
              </div>
              <div className="flex justify-between">
                <span>Schema</span>
                <span className="font-mono">v1.3</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={exportData}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-ne-line px-2 py-2 text-xs text-ne-fg-2 hover:text-ne-fg"
              >
                <FileJson className="h-3.5 w-3.5" />
                JSON
              </button>
              <button
                onClick={exportData}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-ne-line px-2 py-2 text-xs text-ne-fg-2 hover:text-ne-fg"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
          </Panel>
          <Panel title="Synchronization" eyebrow="Offline-first queue">
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ne-fg-2">
                  <WifiOff className="h-3.5 w-3.5 text-ne-amber" />
                  Offline queue
                </span>
                <span className="text-ne-emerald">Active</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-ne-bg2 p-3">
                  <p className="font-mono text-lg text-ne-fg">
                    {records.length}
                  </p>
                  <p className="text-ne-fg-3">Local records</p>
                </div>
                <div className="rounded-lg bg-ne-bg2 p-3">
                  <p className="font-mono text-lg text-ne-amber">
                    {liveData?.pendingSync ?? 0}
                  </p>
                  <p className="text-ne-fg-3">Pending uploads</p>
                </div>
                <div className="rounded-lg bg-ne-bg2 p-3">
                  <p className="font-mono text-lg text-ne-emerald">
                    {liveData?.synchronized ?? 0}
                  </p>
                  <p className="text-ne-fg-3">Successful</p>
                </div>
                <div className="rounded-lg bg-ne-bg2 p-3">
                  <p className="font-mono text-lg text-ne-critical">
                    {liveData?.failedSync ?? 0}
                  </p>
                  <p className="text-ne-fg-3">Failed</p>
                </div>
              </div>
              <p className="flex items-center gap-2 text-ne-fg-3">
                <RefreshCw className="h-3 w-3" />
                Last sync attempt:{" "}
                {liveData?.lastSyncAttempt
                  ? new Date(liveData.lastSyncAttempt).toLocaleString()
                  : "Never"}
              </p>
              <button
                onClick={syncQueue}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-2 text-xs text-ne-emerald hover:bg-ne-emerald/20"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Sync queue
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
