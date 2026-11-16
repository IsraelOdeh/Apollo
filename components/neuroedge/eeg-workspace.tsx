// components/neuroedge/eeg-workspace.tsx
"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  FileUp,
  Filter,
  Gauge,
  Laptop,
  Play,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { generateBandSignal } from "@/lib/eeg/synthetic-signal";
import { openEdf, blobSource } from "edfcore";
import { db, type Recording, type DetectedEvent } from "@/lib/storage/db";
import {
  getEdfTotalDurationSeconds,
  readDisplaySignals,
  runEdgeScreeningOnRecording,
} from "@/lib/eeg/edge-screening";

const signalColors = ["#42D9F5", "#36E0A1", "#9D85FF", "#F6BD60"];

function formatHMS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatMMSS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function WorkspaceButton({
  children,
  onClick,
  quiet = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  quiet?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        quiet
          ? "border-ne-line bg-transparent text-ne-fg-2 hover:border-ne-cyan/40 hover:text-ne-fg"
          : "border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald hover:bg-ne-emerald/20"
      }`}
    >
      {children}
    </button>
  );
}

function Waveform({
  physicalSignal,
  color,
  height = 54,
  values,
  gain = 1,
}: {
  physicalSignal: ArrayLike<number>;
  color: string;
  height?: number;
  values?: number[];
  gain?: number;
}) {
  const points = useMemo(() => {
    if (values && values.length > 1) {
      let maxAbs = 1e-6;
      for (let i = 0; i < values.length; i++) {
        const a = Math.abs(values[i]);
        if (a > maxAbs) maxAbs = a;
      }
      return values.map((v) => (v / maxAbs) * gain);
    }
    return generateBandSignal("alpha", {
      points: 260,
      seed,
      shift: seed / 8,
    }).map((v) => v * gain);
  }, [values, seed, gain]);

  const path = points
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"} ${(index / (points.length - 1)) * 100} ${Math.max(
          2,
          Math.min(98, 50 - value * 26),
        )}`,
    )
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height }}
      className="w-full overflow-hidden"
      aria-hidden="true"
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
        stroke={color}
        strokeWidth=".9"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function FilterControl({
  label,
  value,
  options,
  enabled,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  enabled: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
        aria-pressed={enabled}
        onClick={onToggle}
        className={`h-5 w-5 rounded border ${
          enabled
            ? "border-ne-emerald bg-ne-emerald text-ne-bg"
            : "border-ne-line bg-ne-bg2 text-transparent"
        }`}
      >
        <Check className="h-3 w-3" />
      </button>
      <label className="min-w-0 flex-1 text-xs text-ne-fg-2">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-[86px] rounded-md border border-ne-line bg-ne-bg2 px-2 py-1.5 text-right text-[11px] text-ne-fg outline-none focus:border-ne-cyan"
        disabled={!enabled}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

export function EegWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{
    name?: string;
    size?: string;
    status?: string;
  }>({});
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [analysis, setAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [detectedEvents, setDetectedEvents] = useState<DetectedEvent[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [gain, setGain] = useState(1.0);
  const [zoom, setZoom] = useState(1);
  const [montage, setMontage] = useState("Referential");
  const [filters, setFilters] = useState({
    high: true,
    low: true,
    notch: false,
  });
  const [filterValues, setFilterValues] = useState({
    high: "1 Hz",
    low: "45 Hz",
    notch: "50 Hz",
  });
  const [recording, setRecording] = useState<Recording | null>(null);
  const [startSec, setStartSec] = useState<number>(0);
  const [signalwindow, setWindow] = useState<number>(10);
  const [channelTraces, setChannelTraces] = useState<Record<string, number[]>>(
    {},
  );

  async function handleRunScreening(targetRec: Recording) {
    setAnalysis(true);
    setAnalysisProgress(5);
    try {
      const { events } = await runEdgeScreeningOnRecording(targetRec, (pct) =>
        setAnalysisProgress(pct),
      );
      setDetectedEvents(events);
      const updated = await db.recordings.get(targetRec.id);
      if (updated) setRecording(updated);
      setFile((prev) => ({ ...prev, status: "Screened" }));
    } catch (error) {
      console.error("Error running model screening:", error);
    } finally {
      setAnalysis(false);
    }
  }

  async function importFile(nextFile?: File) {
    if (!nextFile || !/\.edf(\+)?$/i.test(nextFile.name)) return;
    const id = crypto.randomUUID();
    try {
      const edfFile = await openEdf(blobSource(nextFile));
      const samplingRate = edfFile.header.signals[0]?.sampleRateHz ?? 256;
      const channelCount = edfFile.header.signals.length;
      const duration = getEdfTotalDurationSeconds(edfFile, nextFile.size);
      const recordingDateValue = edfFile.header.startTime?.resolvedDate;
      const calendarDate =
        recordingDateValue &&
        typeof recordingDateValue === "object" &&
        "year" in recordingDateValue &&
        "month" in recordingDateValue &&
        "day" in recordingDateValue
          ? (recordingDateValue as unknown as Record<
              string,
              number | string | undefined
            >)
          : null;
      const recordingDate: Date =
        recordingDateValue instanceof Date
          ? recordingDateValue
          : calendarDate
            ? new Date(
                Number(calendarDate.year),
                Number(calendarDate.month) - 1,
                Number(calendarDate.day),
                Number(calendarDate.hour ?? 0),
                Number(calendarDate.minute ?? 0),
                Number(calendarDate.second ?? 0),
                Number(calendarDate.millisecond ?? 0),
              )
            : new Date();
      const chLabels = edfFile.header.signals.map(
        (signal: any) => signal.label,
      );

      const newRecording: Recording = {
        id,
        recording_name: nextFile.name,
        file_blob: new Blob([nextFile], {
          type: "application/octet-stream",
        }),
        file_format: "EDF",
        file_size: nextFile.size,
        sampling_rate: samplingRate,
        channel_count: channelCount,
        channels: chLabels,
        duration,
        recording_date: recordingDate,
        imported_at: new Date(),
        source: "upload",
        quality_status: "unknown",
        screening_status: "imported",
      };

      await db.recordings.add(newRecording);
      localStorage.setItem("ne_active_recording_id", id);

      const url = new URL(window.location.href);
      url.searchParams.set("recording", id);
      window.history.replaceState({}, "", url.toString());

      setRecording(newRecording);
      setStartSec(0);
      setFile({
        name: nextFile.name,
        size: `${(nextFile.size / 1024 / 1024).toFixed(1)} MB`,
        status: "Screening...",
      });

      // Automatically run edge_model.json screening upon import
      await handleRunScreening(newRecording);
    } catch (error) {
      console.error("Error importing EDF recording:", error);
    }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    importFile(event.dataTransfer.files[0]);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) =>
    importFile(event.target.files?.[0]);

  const visibleChannels = useMemo(
    () => channels.filter((channel) => visible[channel]),
    [channels, visible],
  );

  // Load recording from URL query parameter or latest imported recording in IndexedDB
  useEffect(() => {
    async function loadInitialRecording() {
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
      if (rec) {
        localStorage.setItem("ne_active_recording_id", rec.id);
        setRecording(rec);
        const sessions = await db.screening_sessions
          .where("recording_id")
          .equals(rec.id)
          .toArray();
        if (sessions.length > 0) {
          const latest = sessions[sessions.length - 1];
          const evs = await db.detected_events
            .where("session_id")
            .equals(latest.id)
            .sortBy("start_time");
          setDetectedEvents(evs);
        }
      }
    }
    loadInitialRecording();
  }, []);

  // Load recording from URL query parameter or latest imported recording in IndexedDB
  useEffect(() => {
    if (!recording) return;
    setFile({
      name: recording.recording_name,
      size: `${(recording.file_size / 1024 / 1024).toFixed(1)} MB`,
      status:
        recording.screening_status === "imported" ? "Imported" : "Screened",
    });
    const chs = recording.channels || [];
    setChannels(chs);
    setVisible(
      chs.reduce<Record<string, boolean>>(
        (acc, channel) => ({ ...acc, [channel]: true }),
        {},
      ),
    );
  }, [recording?.id]);

  // Read physical EDF waveform window whenever recording, startSec, window length, or filters change
  useEffect(() => {
    if (!recording) return;

    readRecording(recording.file_blob, channels);
  }, [duration, start]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ne-emerald">
            Signal review · display-only
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ne-fg">
            EEG Workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ne-fg-2">
            Inspect multichannel recordings with clinical-grade review controls.
            Source data remains unchanged.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <WorkspaceButton quiet onClick={() => inputRef.current?.click()}>
            <FileUp className="h-3.5 w-3.5" />
            Import Recording
            <input
              ref={inputRef}
              type="file"
              accept=".edf,.edf+"
              onChange={onFileChange}
              className="sr-only"
            />
          </WorkspaceButton>
          <WorkspaceButton
            quiet
            onClick={() =>
              router.push(
                recording
                  ? `/screening?recording=${recording.id}`
                  : "/screening",
              )
            }
          >
            <Laptop className="h-3.5 w-3.5" />
            AI Screening ({detectedEvents.length})
          </WorkspaceButton>
          {/* <WorkspaceButton onClick={() => setAnalysis(!analysis)}>
            <Activity className="h-3.5 w-3.5" />
            {analysis ? "Analysis Running" : "Start Analysis"}
          </WorkspaceButton> */}
        </div>
      </header>

      {(recording && (
        <Panel title="Recording import" eyebrow="EDF / EDF+ · local review">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_2.2fr]">
            <div className="rounded-xl border border-ne-line bg-ne-bg2/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg bg-ne-elevated p-2.5 text-ne-cyan">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-ne-fg">
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-ne-fg-3">
                      {file.size} · {file.status}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ne-emerald/20 bg-ne-emerald/10 px-2 py-1 text-[10px] text-ne-emerald">
                  <Circle className="h-2 w-2 fill-current" />
                  Ready
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-ne-line pt-3 text-xs">
                <div>
                  <p className="text-ne-fg-3">Channels</p>
                  <p className="mt-1 font-mono text-ne-fg">19</p>
                </div>
                <div>
                  <p className="text-ne-fg-3">Sampling frequency</p>
                  <p className="mt-1 font-mono text-ne-fg">256 Hz</p>
                </div>
                <div>
                  <p className="text-ne-fg-3">Duration</p>
                  <p className="mt-1 font-mono text-ne-fg">05:14:00</p>
                </div>
                <div>
                  <p className="text-ne-fg-3">Recording date</p>
                  <p className="mt-1 font-mono text-ne-fg">2026-11-08</p>
                </div>
              </div>
            </div>

            <Panel
              title="Signal controls"
              eyebrow="Display processing"
              bodyClassName="grid grid-cols-2 gap-5"
            >
              <div className="space-y-4">
                <FilterControl
                  label="High-pass filter"
                  value={filterValues.high}
                  options={["0.5 Hz", "1 Hz", "2 Hz"]}
                  enabled={filters.high}
                  onToggle={() =>
                    setFilters({ ...filters, high: !filters.high })
                  }
                  onChange={(value) =>
                    setFilterValues({ ...filterValues, high: value })
                  }
                />
                <FilterControl
                  label="Low-pass filter"
                  value={filterValues.low}
                  options={["30 Hz", "45 Hz", "70 Hz"]}
                  enabled={filters.low}
                  onToggle={() => setFilters({ ...filters, low: !filters.low })}
                  onChange={(value) =>
                    setFilterValues({ ...filterValues, low: value })
                  }
                />
                <FilterControl
                  label="Notch filter"
                  value={filterValues.notch}
                  options={["50 Hz", "60 Hz"]}
                  enabled={filters.notch}
                  onToggle={() =>
                    setFilters({ ...filters, notch: !filters.notch })
                  }
                  onChange={(value) =>
                    setFilterValues({ ...filterValues, notch: value })
                  }
                />
              </div>
              <div>
                <div className="border-t border-ne-line">
                  <div className="mb-2 flex items-center justify-between text-xs text-ne-fg-2">
                    <span className="inline-flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5 text-ne-cyan" />
                      Amplitude gain
                    </span>
                    <span className="font-mono text-ne-fg">1.0×</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    defaultValue="1"
                    className="w-full accent-[#42D9F5]"
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-ne-fg-2">
                    <span>Time window</span>
                    <span className="font-mono text-ne-fg">20 sec</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    defaultValue="20"
                    className="w-full accent-[#42D9F5]"
                  />
                </div>
                <label className="flex items-center justify-between gap-3 text-xs text-ne-fg-2">
                  <span className="inline-flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-ne-amber" />
                    Highlight artifacts
                  </span>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 accent-[#F6BD60]"
                  />
                </label>
              </div>
              {/* <div className="mt-5 rounded-xl border border-ne-cyan/20 bg-ne-cyan/5 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-ne-cyan">
                    <Settings2 className="h-3.5 w-3.5" />
                    Non-destructive view
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-ne-fg-2">
                    Filters and gain affect visualization only. The original
                    recording remains immutable and can be restored at any time.
                  </p>
                  <WorkspaceButton
                    quiet
                    onClick={() =>
                      setFilters({ high: true, low: true, notch: false })
                    }
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset display
                  </WorkspaceButton>
                </div> */}
            </Panel>
          </div>
        </Panel>
      )) || (
        <Panel
          title="Import a recording"
          eyebrow="EDF / EDF+ · Workspace"
          className="w-[64%] justify-self-center"
        >
          <div className="flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition-colors">
            <p className="text-md text-ne-fg-3">No recording selected</p>
            <UploadCloud className="mb-2 h-6 w-6 text-ne-cyan" />
            <p className="text-sm text-ne-fg-3">
              Import an EDF file to get started, or chose one from Recordings
            </p>
          </div>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_308px]">
        <div className="min-w-0 space-y-5">
          {recording && (
            <Panel
              title="Multichannel waveform"
              eyebrow={`${visibleChannels.length} visible channels · ${montage} montage`}
              actions={
                <div className="flex items-center gap-1">
                  <WorkspaceButton
                    quiet
                    onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </WorkspaceButton>
                  <span className="w-12 text-center font-mono text-[10px] text-ne-fg-3">
                    {Math.round(zoom * 100)}%
                  </span>
                  <WorkspaceButton
                    quiet
                    onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </WorkspaceButton>
                </div>
              }
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ne-fg-3">
                <span className="font-mono text-ne-cyan">
                  {playing
                    ? `PLAYBACK ${formatMMSS(startSec)}`
                    : formatMMSS(startSec)}{" "}
                  / {formatHMS(recording.duration)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-ne-emerald" />
                  Filters active on display only
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-ne-line bg-[#0a1118]">
                <div
                  className="min-w-[720px] p-3 pt-0 max-h-[50vh] overflow-y-auto scrollbar-none relative "
                  style={{ width: `${100 * zoom}%`, scrollbarWidth: "none" }}
                >
                  <div className="grid grid-cols-[50px_1fr] gap-3 sticky top-0 stretch">
                    <div></div>
                    <div className="mb-2 flex items-center justify-between text-xs text-ne-fg-2">
                      {Array.from(linspace(start, start + duration, 5)).map(
                        (time, index) => {
                          return (
                            <div>
                              <span key={index}>{formatDuration(time)}</span>
                              <div className="h-[100vh] absolute w-px bg-[#fcfcfccc]" />
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                  {
                    Object.values(signalScreen).map(
                      (entry, index) =>
                        visible[entry.channelId] && (
                          <div
                            key={index}
                            className="grid grid-cols-[50px_1fr] items-center gap-3 border-b border-ne-line/50 py-1.5 last:border-0"
                          >
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-mono text-[10px] text-ne-fg-2">
                                {entry.channel}
                              </span>
                              <span className="font-mono text-[9px] text-ne-fg-3">
                                ±{Math.round(entry.amplitude)} µV
                              </span>
                            </div>
                            <div className="relative text-ne-cyan">
                              <Waveform
                                physicalSignal={entry.signal}
                                color={
                                  signalColors[index % signalColors.length]
                                }
                              />
                            </div>
                          </div>
                        ),
                      // }
                    )
                    // )
                  }
                </div>
              </div>
              <div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <WorkspaceButton
                    quiet
                    onClick={() =>
                      setStartSec(Math.max(0, startSec - signalwindow))
                    }
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </WorkspaceButton>
                  <WorkspaceButton
                    quiet
                    onClick={() =>
                      setStartSec(
                        Math.min(
                          Math.max(0, recording.duration - signalwindow),
                          startSec + signalwindow,
                        ),
                      )
                    }
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </WorkspaceButton>
                  <div className="flex items-center justify-between gap-1.5 text-xs text-ne-fg-2">
                    <span className="inline-flex items-center gap-2">
                      Start
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={Math.max(
                        0,
                        Math.floor(recording.duration - signalwindow),
                      )}
                      step="1"
                      value={startSec}
                      onChange={(e) =>
                        setStartSec(Math.max(0, Number(e.target.value)))
                      }
                      className="w-20 rounded-lg border border-ne-line bg-ne-bg2 px-2 py-1.5 text-xs text-ne-fg outline-none focus:border-ne-cyan"
                    />
                    <span className="inline-flex items-center gap-2">s</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 text-xs text-ne-fg-2">
                    <span className="inline-flex items-center gap-2">
                      Window
                    </span>
                    <select
                      value={signalwindow}
                      onChange={(event) =>
                        setDuration(Number(event.target.value))
                      }
                      className="ml-auto rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-xs text-ne-fg outline-none focus:border-ne-cyan"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={60}>60</option>
                    </select>
                    <span className="inline-flex items-center gap-2">s</span>
                  </div>
                  <select
                    value={montage}
                    onChange={(event) => setMontage(event.target.value)}
                    className="ml-auto rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-xs text-ne-fg outline-none focus:border-ne-cyan"
                  >
                    <option>Referential</option>
                    <option>Average reference</option>
                    <option>Bipolar</option>
                  </select>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-ne-fg-3">
                  <span className="font-mono">{formatMMSS(0)}</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(
                      1,
                      Math.floor(recording.duration - signalwindow),
                    )}
                    step="1"
                    value={startSec}
                    onChange={(e) => setStartSec(Number(e.target.value))}
                    className="w-full accent-[#42D9F5]"
                    onChange={(event) =>
                      setStart(Number(event.target.value) * recording?.duration)
                    }
                  />
                  <span className="font-mono">
                    {formatMMSS(recording.duration)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ne-amber/20 bg-ne-amber/5 px-3 py-2 text-xs text-ne-amber">
                <span>
                  Selected interval: {formatMMSS(startSec)} –{" "}
                  {formatMMSS(startSec + signalwindow)} ·{" "}
                  {seizureCount > 0 || iedCount > 0
                    ? `${seizureCount} suspected seizure(s), ${iedCount} IED candidate(s), ${artifactCount} artifact(s) flagged by model`
                    : "Use slider or arrows to inspect timeline."}
                </span>
                {detectedEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/screening?recording=${recording.id}`)
                    }
                    className="font-mono underline hover:text-ne-fg"
                  >
                    Inspect in AI Screening →
                  </button>
                )}
              </div>
            </Panel>
          )}
        </div>
        {recording && (
          <aside className="space-y-5">
            <Panel
              title="Channel selection"
              eyebrow={`${channels.length} channels`}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {channels.map((channel, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={visible[channel[1]]}
                    onClick={() =>
                      setVisible({
                        ...visible,
                        [channel[1]]: !visible[channel[1]],
                      })
                    }
                    className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                      visible[channel]
                        ? "bg-ne-elevated text-ne-fg"
                        : "text-ne-fg-3 hover:bg-ne-bg2"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        visible[channel] ? "bg-ne-emerald" : "bg-ne-fg-3/40"
                      }`}
                    />
                    {channel}
                  </button>
                ))}
              </div>
            </Panel>
          </aside>
        )}
      </div>
      {(analysis || detectedEvents.length > 0) && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ne-ai/20 bg-ne-ai/5 px-4 py-3 text-xs text-ne-ai"
        >
          <span>
            {analysis
              ? `Running NeuroEdge MLP (edge_model.json) feature extraction & inference... ${analysisProgress}%`
              : `Screening complete: ${seizureCount} suspected seizure(s), ${iedCount} IED candidate(s), and ${artifactCount} artifact segment(s) saved for clinical review.`}
          </span>
          {!analysis && recording && (
            <button
              type="button"
              onClick={() =>
                router.push(`/screening?recording=${recording.id}`)
              }
              className="rounded-lg border border-ne-ai/30 bg-ne-ai/10 px-3 py-1 font-mono text-[11px] text-ne-ai hover:bg-ne-ai/20"
            >
              Open AI Screening
            </button>
          )}
        </div>
      )}
    </div>
  );
}
