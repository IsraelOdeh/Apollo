"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Circle,
  Cpu,
  Gauge,
  Radio,
  Signal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { generateBandSignal } from "@/lib/eeg/synthetic-signal";

const channels = ["Fp1", "Fp2", "F3", "F4", "C3", "C4", "P3", "P4"];

function DemoWaveform({ seed, active }: { seed: number; active: boolean }) {
  const points = useMemo(
    () => generateBandSignal("alpha", { points: 180, seed }),
    [seed],
  );
  const path = points
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"} ${(index / (points.length - 1)) * 100} ${50 - value * 24}`,
    )
    .join(" ");

  return (
    <svg
      aria-label="Synthetic demonstration waveform"
      role="img"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`h-12 w-full ${active ? "opacity-100" : "opacity-30"}`}
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
        strokeWidth=".8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ConnectionPanel() {
  const [streaming, setStreaming] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(channels);
  const [notice, setNotice] = useState("");

  function reportUnavailable(action: string) {
    setNotice(
      `${action} is unavailable: no hardware adapter is configured. No device connection or acquisition was started.`,
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <Panel title="Device connection" eyebrow="Acquisition hardware">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-xl border border-ne-line bg-ne-bg2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3 sm:flex-1">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ne-line bg-ne-elevated text-ne-fg-3">
                <Cpu className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium text-ne-fg">
                  No EEG device connected
                </p>
                <p className="mt-1 text-xs leading-5 text-ne-fg-3">
                  g.tec hardware support is planned; this workspace has no
                  acquisition adapter configured.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ne-line px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-ne-fg-3">
              <WifiOff className="size-3" aria-hidden="true" />
              Disconnected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Available channels" value="—" detail="No device" />
            <Metric
              label="Sampling frequency"
              value="—"
              detail="Not reported"
            />
            <Metric label="Signal stream" value="Inactive" detail="Hardware" />
            <Metric
              label="Connection"
              value="Offline"
              detail="Not established"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reportUnavailable("Connect device")}
              className="rounded-lg bg-ne-emerald px-3.5 py-2.5 text-xs font-semibold text-ne-bg transition hover:brightness-110"
            >
              Connect device
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-ne-line px-3.5 py-2.5 text-xs font-medium text-ne-fg-3 opacity-60"
            >
              Disconnect device
            </button>
            <button
              type="button"
              onClick={() => reportUnavailable("Start acquisition")}
              className="rounded-lg border border-ne-line px-3.5 py-2.5 text-xs font-medium text-ne-fg-2 transition hover:border-ne-cyan/40 hover:text-ne-fg"
            >
              Start acquisition
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-ne-line px-3.5 py-2.5 text-xs font-medium text-ne-fg-3 opacity-60"
            >
              Stop acquisition
            </button>
          </div>
          {notice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-ne-amber/25 bg-ne-amber/5 p-3 text-xs leading-5 text-ne-amber"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {notice}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="Live monitoring"
        eyebrow="Signal stream"
        actions={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${streaming ? "border-ne-amber/30 bg-ne-amber/5 text-ne-amber" : "border-ne-line text-ne-fg-3"}`}
          >
            <Circle
              className={`size-2 ${streaming ? "fill-current" : ""}`}
              aria-hidden="true"
            />
            {streaming ? "Stream running" : "Stream stopped"}
          </span>
        }
      >
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Metric
              label="Packet rate"
              value={streaming ? "64 pkt/s" : "0 pkt/s"}
              detail="Demo stream"
            />
            <Metric
              label="Signal quality"
              value={streaming ? "Good" : "—"}
              detail="Synthetic"
            />
            <Metric
              label="Stability"
              value={streaming ? "Stable" : "—"}
              detail="Demo only"
            />
            <Metric
              label="Channel activity"
              value={
                streaming
                  ? `${selectedChannels.length}/${channels.length}`
                  : "—"
              }
              detail="Selected"
            />
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ne-line bg-ne-bg2 px-3.5 py-3">
            <p className="flex items-center gap-2 text-xs text-ne-fg-2">
              <Activity className="size-4 text-ne-cyan" aria-hidden="true" />
              Demo stream control
            </p>
            <button
              type="button"
              aria-pressed={streaming}
              onClick={() => setStreaming((value) => !value)}
              className="rounded-lg border border-ne-cyan/25 bg-ne-cyan/5 px-3 py-2 text-xs font-medium text-ne-cyan transition hover:bg-ne-cyan/10"
            >
              {streaming ? "Stop stream" : "Start stream"}
            </button>
          </div>
        </div>
      </Panel>
    </section>
  );
}

export function DeviceManager() {
  const [demoStreaming, setDemoStreaming] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(channels);
  const [notice, setNotice] = useState("");

  function reportUnavailable(action: string) {
    setNotice(
      `${action} is unavailable: no hardware adapter is configured. No device connection or acquisition was started.`,
    );
  }

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Panel
          title="Channel activity"
          eyebrow={
            demoStreaming
              ? "Synthetic signals · 256 Hz demo"
              : "Awaiting signal source"
          }
          actions={
            <span className="font-mono text-[10px] text-ne-fg-3">
              {selectedChannels.length} selected
            </span>
          }
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ne-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <Signal className="size-3.5" aria-hidden="true" />
              {demoStreaming ? "Illustrative stream" : "No incoming EEG data"}
            </span>
            <span>Amplitude display is illustrative</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-ne-line bg-ne-bg2 px-3">
            {channels.map((channel, index) => {
              const selected = selectedChannels.includes(channel);
              return (
                <div
                  key={channel}
                  className="grid grid-cols-[38px_minmax(0,1fr)_24px] items-center gap-2 border-b border-ne-line/60 py-1.5 last:border-0 sm:grid-cols-[48px_minmax(0,1fr)_24px] sm:gap-3"
                >
                  <span
                    className={`font-mono text-[10px] ${selected ? "text-ne-cyan" : "text-ne-fg-3"}`}
                  >
                    {channel}
                  </span>
                  <div className="min-w-0">
                    {demoStreaming ? (
                      <DemoWaveform seed={index + 2} active={selected} />
                    ) : (
                      <div className="flex h-12 items-center">
                        <div className="h-px w-full bg-ne-line" />
                      </div>
                    )}
                  </div>
                  <span
                    aria-label={
                      selected ? "Channel selected" : "Channel hidden"
                    }
                    className={`size-2 rounded-full ${selected ? (demoStreaming ? "bg-ne-emerald" : "bg-ne-fg-3") : "bg-ne-line"}`}
                  />
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Channel selection"
          eyebrow="Display and acquisition scope"
        >
          <p className="mb-3 text-xs leading-5 text-ne-fg-3">
            Select channels for monitoring. Hardware channel configuration will
            be available when an adapter is integrated.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {channels.map((channel) => {
              const selected = selectedChannels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleChannel(channel)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs transition ${selected ? "border-ne-cyan/25 bg-ne-cyan/5 text-ne-cyan" : "border-ne-line text-ne-fg-3 hover:text-ne-fg-2"}`}
                >
                  <span className="font-mono">{channel}</span>
                  {selected ? (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Circle className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-ne-line bg-ne-bg2 p-3 text-[11px] leading-4 text-ne-fg-3">
            <Radio
              className="size-4 shrink-0 text-ne-cyan"
              aria-hidden="true"
            />
            Adapter-ready interface for future g.tec device discovery and
            channel mapping.
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-ne-line bg-ne-bg2/70 p-3">
      <p className="text-[10px] text-ne-fg-3">{label}</p>
      <p className="mt-1 font-mono text-sm text-ne-fg">{value}</p>
      <p className="mt-1 text-[10px] text-ne-fg-3">{detail}</p>
    </div>
  );
}
