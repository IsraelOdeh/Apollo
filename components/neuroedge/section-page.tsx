"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileUp,
  Filter,
  Laptop,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { EegWorkspace } from "@/components/neuroedge/eeg-workspace";
import { AiScreening } from "@/components/neuroedge/ai-screening";
import { RecordingsLibrary } from "@/components/neuroedge/recordings-library";
import { BrainDataRepository } from "@/components/neuroedge/brain-data-repository";
import { ReportsPage } from "@/components/neuroedge/reports-page";
import { DeviceManager } from "@/components/neuroedge/device-manager";
import { SettingsPage } from "@/components/neuroedge/settings-page";
import { generateBandSignal } from "@/lib/eeg/synthetic-signal";
import { fetchRecordings } from "@/lib/services/recordings";
import type { Recording } from "@/lib/db/types";

const nav = {
  "/workspace": {
    title: "EEG Workspace",
    eyebrow: "Signal review",
    intro: "Inspect an original recording without modifying the source file.",
  },
  "/screening": {
    title: "AI Screening",
    eyebrow: "Candidate review",
    intro: "Model candidates are review aids, not diagnoses.",
  },
  "/recordings": {
    title: "Recordings",
    eyebrow: "Library",
    intro: "Pseudonymous sessions available on this workstation.",
  },
  "/repository": {
    title: "Brain Data",
    eyebrow: "Repository",
    intro: "Validated metadata and event records for export.",
  },
  "/reports": {
    title: "Reports",
    eyebrow: "Analysis",
    intro: "Separate screening findings from human-confirmed interpretations.",
  },
  "/devices": {
    title: "Device Manager",
    eyebrow: "Acquisition",
    intro: "Hardware is not connected. Demo streams are clearly labeled.",
  },
  "/model": {
    title: "Model Information",
    eyebrow: "Screening model",
    intro: "Transparent model metadata and operating constraints.",
  },
  "/settings": {
    title: "Settings",
    eyebrow: "Workstation",
    intro:
      "Configure workstation preferences, model metadata, and privacy controls.",
  },
} as const;

type SectionPath = keyof typeof nav;

function Button({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "quiet";
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${variant === "quiet" ? "border-ne-line bg-transparent text-ne-fg-2 hover:text-ne-fg" : "border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald hover:bg-ne-emerald/20"}`}
    >
      {children}
    </button>
  );
}

function Waveform({ seed = 3 }: { seed?: number }) {
  const points = generateBandSignal("alpha", { points: 180, seed });
  const path = points
    .map(
      (value, i) =>
        `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 100} ${50 - value * 25}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-40 w-full overflow-visible"
    >
      <path
        d="M0 50 H100"
        stroke="currentColor"
        strokeOpacity=".12"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill="none"
        stroke="#42D9F5"
        strokeWidth=".7"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function RecordingRows({ recordings }: { recordings: Recording[] }) {
  const [query, setQuery] = useState("");
  const filtered = recordings.filter((recording) =>
    recording.pseudonym_id.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Panel
      title="Recording library"
      eyebrow={`${filtered.length} sessions`}
      actions={
        <Button variant="quiet">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </Button>
      }
    >
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search pseudonymous ID"
        className="mb-4 w-full rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-sm text-ne-fg outline-none focus:border-ne-cyan"
      />
      <div className="space-y-2">
        {filtered.map((recording) => (
          <div
            key={recording.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ne-line bg-ne-bg2/70 p-3"
          >
            <div>
              <p className="font-mono text-sm text-ne-fg">
                {recording.pseudonym_id}
              </p>
              <p className="mt-1 text-xs text-ne-fg-3">
                {recording.channel_count} channels · {recording.sampling_hz} Hz
                · {Math.round(recording.duration_seconds)} sec
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs capitalize ${recording.quality === "poor" ? "text-ne-critical" : "text-ne-emerald"}`}
              >
                {recording.quality} quality
              </span>
              <Link
                href={`/workspace?recording=${recording.pseudonym_id}`}
                className="inline-flex items-center gap-1 text-xs text-ne-cyan hover:underline"
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function NeuroEdgeSection({ path }: { path: SectionPath }) {
  const meta = nav[path];
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [running, setRunning] = useState(false);
  const loadRecordings = async () => {
    try {
      setRecordings(await fetchRecordings());
    } catch {
      setRecordings([]);
    }
  };
  const demoEvents = [
    {
      label: "Candidate event",
      time: "00:18.42",
      confidence: "0.87",
      status: "Pending",
    },
    {
      label: "Artifact segment",
      time: "00:41.08",
      confidence: "—",
      status: "Needs review",
    },
    {
      label: "Candidate event",
      time: "01:12.70",
      confidence: "0.74",
      status: "Pending",
    },
  ];
  const signal = useMemo(() => <Waveform seed={path.length} />, [path]);

  return (
    <main className="space-y-6 pb-10">
      {path !== "/workspace" &&
        path !== "/screening" &&
        path !== "/recordings" &&
        path !== "/repository" && (
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ne-emerald">
                {meta.eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ne-fg">
                {meta.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-ne-fg-2">
                {meta.intro}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-ne-line bg-ne-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ne-fg-2">
                Demo data labeled
              </span>
              <span className="rounded-full border border-ne-amber/30 bg-ne-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ne-amber">
                Offline ready
              </span>
            </div>
          </header>
        )}
      {path === "/workspace" && <EegWorkspace />}
      {path === ("/workspace-old" as SectionPath) && (
        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <Panel
            title="Multichannel signal view"
            eyebrow="Original recording · display-only"
            actions={
              <div className="flex gap-2">
                <Button variant="quiet">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </Button>
                <Button onClick={() => setRunning(!running)}>
                  {running ? (
                    <RotateCcw className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {running ? "Pause" : "Play"}
                </Button>
              </div>
            }
          >
            <div className="mb-4 flex items-center justify-between text-xs text-ne-fg-3">
              <span>NE-DEMO-01 · 19 channels</span>
              <span className="font-mono text-ne-cyan">
                {running ? "LIVE PLAYBACK" : "00:00.00 / 05:14.00"}
              </span>
            </div>
            <div className="space-y-1 rounded-xl border border-ne-line bg-ne-bg2 p-4">
              {["Fp1", "Fp2", "F3", "F4", "C3", "C4", "P3", "P4"].map(
                (channel, index) => (
                  <div
                    key={channel}
                    className="grid grid-cols-[42px_1fr] items-center gap-3 border-b border-ne-line/50 py-2 last:border-0"
                  >
                    <span className="font-mono text-[10px] text-ne-fg-3">
                      {channel}
                    </span>
                    <div className="text-ne-cyan">
                      {<Waveform seed={index + 1} />}
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="quiet">
                <FileUp className="h-3.5 w-3.5" />
                Import EDF/EDF+
              </Button>
              <Button variant="quiet">Select montage</Button>
              <Button variant="quiet">Time range</Button>
            </div>
          </Panel>
          <Panel title="Signal controls" eyebrow="Display only">
            <div className="space-y-4 text-sm">
              {[
                ["High-pass", "1 Hz"],
                ["Low-pass", "45 Hz"],
                ["Notch", "60 Hz"],
                ["Gain", "1.0×"],
              ].map(([label, value]) => (
                <label
                  key={label}
                  className="flex items-center justify-between gap-3 text-ne-fg-2"
                >
                  <span>{label}</span>
                  <select
                    defaultValue={value}
                    className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1.5 text-xs text-ne-fg"
                  >
                    <option>{value}</option>
                    <option>Off</option>
                    <option>10 Hz</option>
                  </select>
                </label>
              ))}
              <div className="rounded-lg border border-ne-cyan/20 bg-ne-cyan/5 p-3 text-xs text-ne-fg-2">
                Filters affect visualization only. The original recording is
                never modified.
              </div>
            </div>
          </Panel>
        </div>
      )}
      {path === "/screening" && <AiScreening />}
      {path === ("/screening-old" as SectionPath) && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <Panel
            title="Screening timeline"
            eyebrow="NE-DEMO-01 · model v0.4.2"
            actions={
              <Button onClick={() => setRunning(!running)}>
                {running ? "Processing…" : "Run screening"}
              </Button>
            }
          >
            <div className="rounded-xl border border-ne-line bg-ne-bg2 p-4">
              <div className="mb-5 flex items-center justify-between text-xs text-ne-fg-2">
                <span>0:00</span>
                <span>5:14</span>
              </div>
              <div className="relative h-16 rounded-lg bg-ne-elevated">
                <div className="absolute left-[18%] top-0 h-full w-2 rounded-full bg-ne-ai shadow-[0_0_18px_#9D85FF]" />
                <div className="absolute left-[42%] top-0 h-full w-2 rounded-full bg-ne-amber shadow-[0_0_18px_#F6BD60]" />
                <div className="absolute left-[73%] top-0 h-full w-2 rounded-full bg-ne-ai shadow-[0_0_18px_#9D85FF]" />
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-ne-fg-2">
                <span>
                  <i className="mr-2 inline-block h-2 w-2 rounded-full bg-ne-ai" />
                  Model candidate
                </span>
                <span>
                  <i className="mr-2 inline-block h-2 w-2 rounded-full bg-ne-amber" />
                  Artifact
                </span>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {demoEvents.map((event) => (
                <div
                  key={event.time}
                  className="flex items-center justify-between rounded-lg border border-ne-line bg-ne-bg2 p-3"
                >
                  <div>
                    <p className="text-sm text-ne-fg">{event.label}</p>
                    <p className="font-mono text-xs text-ne-fg-3">
                      {event.time} · confidence {event.confidence}
                    </p>
                  </div>
                  <Button variant="quiet">{event.status}</Button>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Review action" eyebrow="Human review">
            <div className="space-y-4">
              <div className="rounded-xl border border-ne-ai/20 bg-ne-ai/5 p-4">
                <div className="flex items-center gap-2 text-sm text-ne-fg">
                  <Sparkles className="h-4 w-4 text-ne-ai" />
                  Model candidate
                </div>
                <p className="mt-2 text-xs leading-5 text-ne-fg-2">
                  This is a screening candidate for operator review, not an
                  autonomous diagnosis.
                </p>
              </div>
              <textarea
                placeholder="Add review note…"
                className="min-h-24 w-full rounded-lg border border-ne-line bg-ne-bg2 p-3 text-sm text-ne-fg outline-none focus:border-ne-cyan"
              />
              <div className="grid grid-cols-3 gap-2">
                <Button variant="quiet">Mark</Button>
                <Button>Confirm</Button>
                <Button variant="quiet">Reject</Button>
              </div>
            </div>
          </Panel>
        </div>
      )}
      {path === "/recordings" && <RecordingsLibrary />}
      {path === "/repository" && <BrainDataRepository />}
      {path === ("/repository-old" as SectionPath) && (
        <RepositoryPanel recordings={recordings} load={loadRecordings} />
      )}
      {path === "/reports" && <ReportsPage />}
      {path === "/devices" && <DeviceManager />}
      {path === "/model" && <ModelPanel />}
      {path === "/settings" && <SettingsPage />}
    </main>
  );
}

function RecordingsPanel({
  recordings,
  load,
}: {
  recordings: Recording[];
  load: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["16", "Total sessions"],
          ["9", "Screened"],
          ["3", "Awaiting review"],
        ].map(([value, label]) => (
          <Panel key={label} title={value} eyebrow={label}>
            <p className="text-xs text-ne-fg-3">Pseudonymous local records</p>
          </Panel>
        ))}
      </div>
      <RecordingRows recordings={recordings} />
      <div className="flex justify-end">
        <Button onClick={load}>
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh from Neon
        </Button>
      </div>
    </div>
  );
}
function RepositoryPanel({
  recordings,
  load,
}: {
  recordings: Recording[];
  load: () => void;
}) {
  const data = JSON.stringify(
    { generatedAt: new Date().toISOString(), recordings },
    null,
    2,
  );
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <Panel title="Repository explorer" eyebrow="Validated metadata">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["16", "Records"],
            ["42", "Candidate events"],
            ["100%", "Schema valid"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-xl border border-ne-line bg-ne-bg2 p-4"
            >
              <p className="font-mono text-xl text-ne-fg">{value}</p>
              <p className="mt-1 text-xs text-ne-fg-3">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={load}>
            <RotateCcw className="h-3.5 w-3.5" />
            Sync metadata
          </Button>
          <Button
            variant="quiet"
            onClick={() =>
              download("neuroedge-recordings.json", data, "application/json")
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </Button>
        </div>
      </Panel>
      <Panel title="Sync queue" eyebrow="Offline first">
        <div className="flex items-center gap-3 rounded-xl border border-ne-emerald/20 bg-ne-emerald/5 p-4">
          <CheckCircle2 className="h-5 w-5 text-ne-emerald" />
          <div>
            <p className="text-sm text-ne-fg">Queue clear</p>
            <p className="text-xs text-ne-fg-3">Neon is the source of truth</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
function ReportsPanel({
  recordings,
  load,
}: {
  recordings: Recording[];
  load: () => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Panel title="Screening summary" eyebrow="Demo cohort">
        <div className="space-y-4">
          {[
            ["Screened sessions", "9", "56%"],
            ["Candidate events", "42", ""],
            ["Poor quality", "2", "12%"],
            ["Confirmed by operator", "18", ""],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-ne-line pb-3"
            >
              <span className="text-sm text-ne-fg-2">{label}</span>
              <span className="font-mono text-ne-cyan">
                {value} <small className="text-ne-fg-3">{detail}</small>
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Exports" eyebrow="Print-ready">
        <p className="text-sm text-ne-fg-2">
          Findings and confirmed interpretations remain separate in every
          export.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="quiet" onClick={() => window.print()}>
            <Download className="h-3.5 w-3.5" />
            Print / PDF
          </Button>
          <Button onClick={load}>
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </Panel>
    </div>
  );
}
function DevicePanel() {
  const [stream, setStream] = useState(false);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <Panel title="Acquisition device" eyebrow="Hardware status">
        <div className="rounded-xl border border-ne-line bg-ne-bg2 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-ne-elevated p-3">
                <Laptop className="h-5 w-5 text-ne-fg-2" />
              </div>
              <div>
                <p className="text-sm text-ne-fg">No device connected</p>
                <p className="mt-1 text-xs text-ne-fg-3">
                  g.tec integration available in a future release
                </p>
              </div>
            </div>
            <WifiOff className="h-4 w-4 text-ne-fg-3" />
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="quiet">Connect device</Button>
            <Button onClick={() => setStream(!stream)}>
              {stream ? "Stop demo stream" : "Start demo stream"}
            </Button>
          </div>
        </div>
      </Panel>
      <Panel title="Demo stream" eyebrow="Synthetic signal">
        <div className="flex items-center gap-2 text-xs text-ne-amber">
          <Activity className="h-4 w-4" />
          {stream ? "Streaming demo data" : "Stopped"}
        </div>
        <div className="mt-4 opacity-70">{signalForDevice()}</div>
      </Panel>
    </div>
  );
}
function signalForDevice() {
  return <Waveform seed={19} />;
}
function ModelPanel() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Panel title="NeuroEdge Screening Model" eyebrow="Model card">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Version", "v0.4.2"],
            ["Size", "48.2 MB"],
            ["Input", "256 Hz EEG"],
            ["Updated", "2026-10-31"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-ne-line bg-ne-bg2 p-4"
            >
              <p className="text-xs text-ne-fg-3">{label}</p>
              <p className="mt-2 font-mono text-sm text-ne-fg">{value}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Supported tasks" eyebrow="Scope">
        <ul className="space-y-3 text-sm text-ne-fg-2">
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-ne-emerald" />
            IED candidate screening
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-ne-emerald" />
            Artifact segmentation
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 text-ne-cyan" />
            No autonomous diagnosis
          </li>
        </ul>
      </Panel>
    </div>
  );
}
function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
