"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  Activity,
  ArrowRightIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  FileUp,
  Filter,
  Gauge,
  History,
  Laptop,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Square,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import {
  openEdf,
  blobSource,
  getSignal,
  readWindow,
  toPhysical,
} from "edfcore";
import {
  db,
  DetectedEvent,
  type ScreeningSession as DbScreeningSession,
} from "@/lib/storage/db";
import { useRecording } from "@/hooks/use-recording";
import { Recording } from "@/lib/storage/types";
import { add } from "dexie";
import { Slider } from "@radix-ui/react-slider";
import { read } from "node:fs";
import { readDisplaySignals } from "@/lib/eeg/edge-screening";
import { ConnectionPanel } from "./device-manager";
import { useRouter } from "next/navigation";

const signalColors = ["#42D9F5", "#36E0A1", "#9D85FF", "#F6BD60"];



// Add this helper right below your imports:
function linspace(start: number, end: number, count: number): number[] {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function formatDuration(seconds: number) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const remainingMilliseconds = totalMilliseconds % 60000;
  const remainingSeconds = Math.floor(remainingMilliseconds / 1000);
  const hundredths = Math.floor((remainingMilliseconds % 1000) / 10);

  return [minutes, remainingSeconds, hundredths]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatScreeningDate(value?: Date) {
  if (!value) return "In progress";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function screeningStatusStyle(status: string) {
  if (status === "completed") {
    return "border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald";
  }
  if (status === "failed") {
    return "border-ne-critical/30 bg-ne-critical/10 text-ne-critical";
  }
  return "border-ne-amber/30 bg-ne-amber/10 text-ne-amber";
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${quiet ? "border-ne-line bg-transparent text-ne-fg-2 hover:border-ne-cyan/40 hover:text-ne-fg" : "border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald hover:bg-ne-emerald/20"}`}
    >
      {children}
    </button>
  );
}

function Waveform({
  physicalSignal,
  color,
  height = 54,
}: {
  physicalSignal: ArrayLike<number>;
  color: string;
  height?: number;
}) {
  const samples = Array.from(physicalSignal).filter(Number.isFinite);
  const denominator = Math.max(samples.length - 1, 1);
  const path = samples
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"} ${(index / denominator) * 100} ${50 - value * 0.25}`,
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
  value: number;
  options: number[];
  enabled: boolean;
  onToggle: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
        aria-pressed={enabled}
        onClick={onToggle}
        className={`h-5 w-5 rounded border ${enabled ? "border-ne-emerald bg-ne-emerald text-ne-bg" : "border-ne-line bg-ne-bg2 text-transparent"}`}
      >
        <Check className="h-3 w-3" />
      </button>
      <label className="min-w-0 flex-1 text-xs text-ne-fg-2">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
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

async function addRecording(nextFile?: File) {
  if (!nextFile || !/\.edf(\+)?$/i.test(nextFile.name)) return;

  const id = crypto.randomUUID();

  console.log("Adding test recording with ID:", id);

  try {
    const edfFile = await openEdf(blobSource(nextFile));

    const samplingRate = edfFile.header.signals[0].sampleRateHz || 256;
    const channelCount = edfFile.header.signals.length;
    const duration = edfFile.header.signals[0].sampleCount / samplingRate;
    const resolvedDate = edfFile.header.startTime.resolvedDate;
    const dateParts = resolvedDate as unknown as Record<
      string,
      number | undefined
    >;
    const recordingDate = resolvedDate
      ? new Date(
          dateParts.year as number,
          (dateParts.month as number) - 1,
          dateParts.day as number,
          dateParts.hours ?? dateParts.hour ?? 0,
          dateParts.minutes ?? dateParts.minute ?? 0,
          dateParts.seconds ?? dateParts.second ?? 0,
          dateParts.milliseconds ?? dateParts.millisecond ?? 0,
        )
      : new Date();
    const channels = edfFile.header.signals.map((signal) => signal.label);

    console.log("Sampling rate:", samplingRate);

    const recording = {
      id,
      recording_name: nextFile.name,
      file_blob: new Blob([nextFile], {
        type: "application/octet-stream",
      }),
      file_format: "EDF" as const,
      file_size: nextFile.size,
      sampling_rate: samplingRate,
      channel_count: channelCount,
      channels: channels,
      duration: duration,
      recording_date: recordingDate,
      imported_at: new Date(),
      source: "upload" as const,
      quality_status: "unknown" as const,
      screening_status: "imported" as const,
    };

    await db.recordings.add(recording);

    console.log("Recording added:", recording);

    // Reload page with query
    const url = new URL(window.location.href);
    url.searchParams.set("recording", id);
    window.history.replaceState({}, "", url.toString());
    window.location.reload();
  } catch (error) {
    console.error("Error reading recording:", error);
  }
}

export function EegWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{
    name: string;
    size: string;
    status: string;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [analysis, setAnalysis] = useState(false);
  const [mode, setMode] = useState<"imported" | "live">("imported");
  const [channels, setChannels] = useState<[string, number][]>([]);
  const [visible, setVisible] = useState<Record<number, boolean>>({});
  const [range, setRange] = useState(38);
  const [zoom, setZoom] = useState(1);
  const [montage, setMontage] = useState("Referential");
  const [pointsToDisplay, setPointsToDisplay] = useState(360);
  const [selectedEvent, setSelectedEvent] = useState<DetectedEvent | null>(
    null,
  );
  const [filters, setFilters] = useState({
    high: true,
    low: true,
    notch: false,
  });
  const [filterValues, setFilterValues] = useState({
    high: 1,
    low: 45,
    notch: 60,
  });
  const [loadingWindow, setLoadingWindow] = useState<boolean>(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [screeningHistory, setScreeningHistory] = useState<
    Array<DbScreeningSession & { eventCount: DetectedEvent[] }>
  >([]);
  const [loadingScreeningHistory, setLoadingScreeningHistory] = useState(false);
  const [signalScreen, setSignalScreen] = useState<
    Record<
      number,
      {
        channelId: number;
        channel: string;
        signal: number[];
        amplitude: number;
      }
    >
  >({});
  //tuneers
  const [duration, setDuration] = useState<number>(60);
  const [start, setStart] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);

  const updateStartTime = () => setStartTime(start);

  const importFile = (nextFile?: File) => {
    if (!nextFile || !/\.edf(\+)?$/i.test(nextFile.name)) return;
    console.log("Importing file:", nextFile.name, nextFile.size);

    addRecording(nextFile);

    setFile({
      name: nextFile.name,
      size: `${(nextFile.size / 1024 / 1024).toFixed(1)} MB`,
      status: "Imported",
    });
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    importFile(event.dataTransfer.files[0]);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) =>
    importFile(event.target.files?.[0]);

  const visibleChannels = useMemo(
    () =>
      Object.values(signalScreen).filter(
        (channel) => visible[channel.channelId],
      ),
    [signalScreen, visible],
  );

  useEffect(() => {
    const sourceUrl = new URLSearchParams(window.location.search).get(
      "recording",
    );
    if (!sourceUrl) return;

    console.log("Loading recording from URL parameter:", sourceUrl);
    // const recording = useRecording();

    const recording = db.recordings
      .get(sourceUrl)
      .then((recording) => {
        setRecording(recording || null);
        console.log("Recording loaded from IndexedDB:", recording);
      })
      .catch((error) => {
        console.error("Error loading recording:", error);
      });
  }, []);

  useEffect(() => {
    if (!recording) return;

    console.log("Recording loaded:", recording.recording_name, recording.id);

    setFile({
      name: recording.recording_name,
      size: `${(recording?.file_size / 1024 / 1024).toFixed(1)} MB`,
      status: "Imported",
    });

    const channels = recording.channels.map(
      (channelName, channelIndex) =>
        [channelName, channelIndex] as [string, number],
    );

    console.log("Channels extracted from recording:", channels);

    setChannels(channels);
    setVisible(
      channels
        .map((channel) => channel[1])
        .reduce<
          Record<number, boolean>
        >((acc, channel) => ({ ...acc, [channel]: true }), {}),
    );

    // readRecording(recording.file_blob, channels);
    readDisplaySignals(
      recording.file_blob,
      startTime,
      duration,
      pointsToDisplay,
      {
        highPassHz: filters.high ? filterValues.high : null,
        lowPassHz: filters.low ? filterValues.low : null,
        notchHz: filters.notch ? filterValues.notch : null,
      },
    )
      .then((signalWindow) => {
        setSignalScreen(signalWindow);
        console.log("Signal window read and set:", signalWindow);
      })
      .catch((error) => {
        console.error("Error reading signal window:", error);
      });
  }, [recording]);

  useEffect(() => {
    if (!recording) return;

    if (loadingWindow) return;

    setLoadingWindow(true);
    // readRecording(recording.file_blob, channels);
    readDisplaySignals(
      recording.file_blob,
      startTime,
      duration,
      pointsToDisplay,
      {
        highPassHz: filters.high ? filterValues.high : null,
        lowPassHz: filters.low ? filterValues.low : null,
        notchHz: filters.notch ? filterValues.notch : null,
      },
    )
      .then((signalWindow) => {
        setSignalScreen(signalWindow);
        setLoadingWindow(false);
      })
      .catch((error) => {
        console.error("Error reading signal window:", error);
      });
  }, [duration, startTime, filters, filterValues, pointsToDisplay]);

  useEffect(() => {
    let cancelled = false;

    async function loadScreeningHistory() {
      if (!recording) {
        setScreeningHistory([]);
        return;
      }

      setLoadingScreeningHistory(true);
      try {
        const sessions = await db.screening_sessions
          .where("recording_id")
          .equals(recording.id)
          .sortBy("started_at");

        console.log(sessions);

        const history = await Promise.all(
          sessions.reverse().map(async (session) => ({
            ...session,
            eventCount: await db.detected_events
              .where("session_id")
              .equals(session.id)
              .toArray(),
          })),
        );

        console.log(history);

        if (!cancelled) setScreeningHistory(history);
      } catch (error) {
        console.error("Error loading screening history:", error);
        if (!cancelled) setScreeningHistory([]);
      } finally {
        if (!cancelled) setLoadingScreeningHistory(false);
      }
    }

    loadScreeningHistory();

    return () => {
      cancelled = true;
    };
  }, [recording]);

  function selectEvent(event: DetectedEvent) {
    setSelectedEvent(event);

    if (recording) {
      const eventLength = Math.max(0, event.end_time - event.start_time);
      const nextDuration =
        [5, 10, 20, 30, 60].find((option) => option >= eventLength) ?? 60;
      const maxStart = Math.max(0, recording.duration - nextDuration);
      const paddedStart = Math.max(0, event.start_time - eventLength * 0.1);

      setDuration(nextDuration);
      setStartTime(Math.min(paddedStart, maxStart));
    }

    if (event.channels.length > 0) {
      const matchingIds = channels
        .filter(([channelName]) =>
          event.channels.some(
            (eventChannel) =>
              eventChannel.toLowerCase() === channelName.toLowerCase(),
          ),
        )
        .map(([, channelId]) => channelId);

      if (matchingIds.length > 0) {
        setVisible(
          channels.reduce<Record<number, boolean>>(
            (nextVisible, [, channelId]) => ({
              ...nextVisible,
              [channelId]: matchingIds.includes(channelId),
            }),
            {},
          ),
        );
      }
    }
  }

  function ReadingPanel() {
    return (
      <Panel
        title="Multichannel waveform"
        eyebrow={`${visibleChannels.length} visible channels · ${montage} montage`}
        actions={
          <div className="flex items-center gap-3">
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
            <WorkspaceButton
              onClick={() =>
                router.push(`/screening?recording=${recording?.id}`)
              }
            >
              AI Screening
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </WorkspaceButton>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ne-fg-3">
          <span className="font-mono text-ne-cyan"></span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ne-emerald" />
            Filters active on display only
          </span>
        </div>
        <div className="overflow-auto rounded-xl border border-ne-line bg-[#0a1118]">
          <div
            className="min-w-[720px] p-3 pt-0 max-h-[50vh] overflow-y-auto scrollbar-none relative "
            style={{
              width: `${100 * zoom}%`,
              scrollbarWidth: "none",
            }}
          >
            <div className="grid grid-cols-[50px_1fr] gap-3 sticky top-0 stretch">
              <div></div>
              <div className="mb-2 flex items-center justify-between text-xs text-ne-fg-2">
                {Array.from(linspace(startTime, startTime + duration, 5)).map(
                  (time, index) => {
                    return (
                      <div>
                        <span key={index}>{formatDuration(time)}</span>
                        <div className="h-[50vh] absolute w-px bg-[#fcfcfccc]" />
                      </div>
                    );
                  },
                )}
              </div>
            </div>
            {
              Object.values(visibleChannels).map(
                (entry, index) => (
                  // visible[entry.channelId] &&
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
                      {selectedEvent &&
                        (() => {
                          console.log("Selected event:", selectedEvent);
                          const eventStart = Math.max(
                            selectedEvent.start_time,
                            startTime,
                          );
                          const eventEnd = Math.min(
                            selectedEvent.end_time,
                            startTime + duration,
                          );

                          if (eventEnd <= eventStart) return null;

                          const left =
                            ((eventStart - startTime) / duration) * 100;
                          const width =
                            ((eventEnd - eventStart) / duration) * 100;

                          return (
                            <div
                              className="pointer-events-none absolute inset-y-0 z-10 rounded-sm border-x border-ne-amber/70 bg-ne-amber/15 bg-ne-amber/25"
                              style={{ left: `${left}%`, width: `${width}%` }}
                            >
                              <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-ne-amber" />
                            </div>
                          );
                        })()}
                      <Waveform
                        physicalSignal={entry.signal}
                        color={signalColors[index % signalColors.length]}
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
              onClick={() => setStartTime(Math.max(startTime - 0.1, 0))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </WorkspaceButton>
            <WorkspaceButton
              quiet
              onClick={() =>
                setStartTime(
                  Math.min(
                    startTime + 0.1,
                    Math.max((recording?.duration ?? 0) - duration, 0),
                  ),
                )
              }
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </WorkspaceButton>

            <div className="gap-1.5 flex items-center justify-between text-xs text-ne-fg-2">
              <span className="inline-flex items-center gap-2">Start</span>
              <input
                type="number"
                min="0"
                max={(recording?.duration ?? 0) - duration}
                step="0.1"
                value={startTime.toFixed(2)}
                onBlur={(event) => updateStartTime()}
                onChange={(event) => setStart(Number(event.target.value))}
                className="w-full accent-[#42D9F5]"
              />
              <span className="inline-flex items-center gap-2">s</span>
            </div>

            <div className="gap-1.5 flex items-center justify-between text-xs text-ne-fg-2">
              <span className="inline-flex items-center gap-2">Window</span>
              <select
                value={duration}
                onChange={(event) => {
                  console.log(
                    (recording?.duration ?? 0) - startTime <
                      Number(event.target.value),
                  );
                  console.log(
                    (recording?.duration ?? 0) - Number(event.target.value),
                  );
                  setStartTime(
                    (recording?.duration ?? 0) - startTime <
                      Number(event.target.value)
                      ? (recording?.duration ?? 0) - Number(event.target.value)
                      : startTime,
                  );
                  setDuration(Number(event.target.value));
                }}
                className="ml-auto rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-xs text-ne-fg outline-none focus:border-ne-cyan"
              >
                <option>5</option>
                <option>10</option>
                <option>20</option>
                <option>30</option>
                <option>60</option>
              </select>
              <span className="inline-flex items-center gap-2">s</span>
            </div>

            <div className="gap-1.5 flex items-center justify-between text-xs text-ne-fg-2">
              <span className="inline-flex items-center gap-2">
                Display points
              </span>
              <select
                value={pointsToDisplay}
                onChange={(event) =>
                  setPointsToDisplay(Number(event.target.value))
                }
                className="ml-auto rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-xs text-ne-fg outline-none focus:border-ne-cyan"
              >
                <option>180</option>
                <option>360</option>
                <option>540</option>
                <option>1080</option>
                <option>2160</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-2">
              {formatDuration(startTime)}
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.0001"
              value={startTime / ((recording?.duration ?? 0) - duration) || 0}
              className="w-full accent-[#42D9F5]"
              onChange={(event) =>
                setStartTime(
                  Number(event.target.value) *
                    ((recording?.duration ?? 0) - duration),
                )
              }
            />
            <span className="inline-flex items-center gap-2">
              {formatDuration(
                (recording as Recording & { duration?: number })?.duration ??
                  duration,
              )}
            </span>
          </div>
        </div>
      </Panel>
    );
  }

  function ChannelPanel() {
    return (
      <Panel title="Channel selection" eyebrow={`${channels.length} channels`}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-ne-fg-3">
          <WorkspaceButton
            quiet
            onClick={() =>
              setVisible({
                ...visible,
                ...Object.fromEntries(
                  channels.map((channel) => [channel[1], true]),
                ),
              })
            }
          >
            All
          </WorkspaceButton>
          <WorkspaceButton
            quiet
            onClick={() =>
              setVisible({
                ...visible,
                ...Object.fromEntries(
                  channels.map((channel) => [channel[1], false]),
                ),
              })
            }
          >
            None
          </WorkspaceButton>
        </div>
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
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${visible[channel[1]] ? "bg-ne-elevated text-ne-fg" : "text-ne-fg-3 hover:bg-ne-bg2"}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${visible[channel[1]] ? "bg-ne-emerald" : "bg-ne-fg-3/40"}`}
              />
              {channel[0]}
              {/* <span className="ml-auto font-mono text-[9px] text-ne-fg-3">
                      ±50
                    </span> */}
            </button>
          ))}
        </div>
      </Panel>
    );
  }

  function ScreeningHistoryPanel() {
    return (
      <Panel
        title="Screening history"
        eyebrow={
          loadingScreeningHistory
            ? "Loading local sessions"
            : `${screeningHistory.length} local session${screeningHistory.length === 1 ? "" : "s"}`
        }
        actions={<History className="h-4 w-4 text-ne-fg-3" />}
      >
        {loadingScreeningHistory ? (
          <p className="text-xs text-ne-fg-3">Loading screening sessions…</p>
        ) : screeningHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ne-line px-4 py-6 text-center">
            <History className="mx-auto h-5 w-5 text-ne-fg-3" />
            <p className="mt-2 text-sm text-ne-fg-2">
              No screening sessions yet
            </p>
            <p className="mt-1 text-[11px] text-ne-fg-3">
              Run AI Screening to create a local screening record.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {screeningHistory.map((session) => (
              <details
                key={session.id}
                className="group rounded-xl border border-ne-line bg-ne-bg2/50"
              >
                <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ne-fg">
                        {session.overall_result ?? "Screening in progress"}
                      </p>
                      <p className="mt-1 text-[11px] text-ne-fg-3">
                        {formatScreeningDate(session.started_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] capitalize ${screeningStatusStyle(session.status)}`}
                      >
                        {session.status}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-ne-fg-3 transition-transform group-open:rotate-90" />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 border-t border-ne-line pt-3 text-[11px] sm:grid-cols-3">
                    <div>
                      <p className="text-ne-fg-3">Model</p>
                      <p className="mt-1 font-mono text-ne-fg">
                        {session.model_version}
                      </p>
                    </div>
                    <div>
                      <p className="text-ne-fg-3">Events</p>
                      <p className="mt-1 font-mono text-ne-fg">
                        {session.eventCount.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-ne-fg-3">Inference</p>
                      <p className="mt-1 font-mono text-ne-fg">
                        {session.inference_duration == null
                          ? "—"
                          : `${(session.inference_duration / 1000).toFixed(1)} s`}
                      </p>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-ne-line px-4 pb-4 pt-3">
                  {session.eventCount.length === 0 ? (
                    <p className="text-[11px] text-ne-fg-3">
                      No detected events for this session.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {session.eventCount
                        .slice()
                        .sort((a, b) => a.start_time - b.start_time)
                        .map((event) => (
                          <button
                            type="button"
                            onClick={() => selectEvent(event)}
                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                              selectedEvent?.id === event.id
                                ? "border-ne-amber/50 bg-ne-amber/10"
                                : "border-ne-line/70 bg-ne-bg/60 hover:border-ne-cyan/40"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-medium capitalize text-ne-fg">
                                  {event.event_type.replaceAll("_", " ")}
                                </p>
                                <p className="mt-1 font-mono text-[10px] text-ne-fg-3">
                                  {formatDuration(event.start_time)} –{" "}
                                  {formatDuration(event.end_time)}
                                </p>
                              </div>
                              <span className="rounded-full border border-ne-line px-2 py-1 text-[10px] capitalize text-ne-fg-2">
                                {event.review_status}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ne-fg-3">
                              <span>
                                Confidence:{" "}
                                <span className="font-mono text-ne-fg-2">
                                  {Math.round(event.confidence * 100)}%
                                </span>
                              </span>
                              {event.channels.length > 0 && (
                                <span>
                                  Channels:{" "}
                                  <span className="font-mono text-ne-fg-2">
                                    {event.channels.join(", ")}
                                  </span>
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </Panel>
    );
  }

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
          <WorkspaceButton
            quiet
            onClick={() => {
              setMode("imported");
              inputRef.current?.click();
            }}
          >
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
            onClick={() => setMode(mode === "imported" ? "live" : "imported")}
          >
            <Laptop className="h-3.5 w-3.5" />
            Device Connection
          </WorkspaceButton>
          {/* <WorkspaceButton onClick={() => setAnalysis(!analysis)}>
            <Activity className="h-3.5 w-3.5" />
            {analysis ? "Analysis Running" : "Start Analysis"}
          </WorkspaceButton> */}
        </div>
      </header>

      {mode === "live" ? (
        <>
          <ConnectionPanel />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_308px] relative">
            <ReadingPanel />
            <aside className="space-y-5 sticky h-fit top-24">
              <ChannelPanel />
            </aside>
          </div>
        </>
      ) : recording ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_308px] relative">
            <div className="grid gap-5">
              <Panel
                title="Recording import"
                eyebrow="EDF / EDF+ · local review"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_1fr]">
                  <div className="rounded-xl border border-ne-line bg-ne-bg2/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-lg bg-ne-elevated p-2.5 text-ne-cyan">
                          <Download className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm text-ne-fg">
                            {file?.name}
                          </p>
                          <p className="mt-1 text-xs text-ne-fg-3">
                            {file?.size} · {file?.status}
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
                        <p className="mt-1 font-mono text-ne-fg">
                          {recording?.channel_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-ne-fg-3">Sampling frequency</p>
                        <p className="mt-1 font-mono text-ne-fg">
                          {recording?.sampling_rate} Hz
                        </p>
                      </div>
                      <div>
                        <p className="text-ne-fg-3">Duration</p>
                        <p className="mt-1 font-mono text-ne-fg">
                          {formatDuration(recording?.duration)}
                        </p>
                      </div>
                      <div>
                        <p className="text-ne-fg-3">Recording date</p>
                        <p className="mt-1 font-mono text-ne-fg">
                          {`${recording?.recording_date?.getFullYear()}-${recording?.recording_date?.getMonth()}-${recording?.recording_date?.getDay()}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Panel
                    title="Signal controls"
                    eyebrow="Display processing"
                    bodyClassName=""
                  >
                    <div className="space-y-4">
                      <FilterControl
                        label="High-pass filter"
                        value={filterValues.high}
                        options={[0.5, 1, 2]}
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
                        options={[30, 45, 70]}
                        enabled={filters.low}
                        onToggle={() =>
                          setFilters({ ...filters, low: !filters.low })
                        }
                        onChange={(value) =>
                          setFilterValues({ ...filterValues, low: value })
                        }
                      />
                      <FilterControl
                        label="Notch filter"
                        value={filterValues.notch}
                        options={[50, 60]}
                        enabled={filters.notch}
                        onToggle={() =>
                          setFilters({ ...filters, notch: !filters.notch })
                        }
                        onChange={(value) =>
                          setFilterValues({ ...filterValues, notch: value })
                        }
                      />
                    </div>
                    <div></div>
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

              <div className="min-w-0 space-y-5">
                <ReadingPanel />
              </div>
            </div>
            <aside className="space-y-5 sticky h-fit top-24">
              <ChannelPanel />
            </aside>
          </div>
          <ScreeningHistoryPanel />
        </>
      ) : (
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
    </div>
  );
}
