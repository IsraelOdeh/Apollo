// components/neuroedge/settings-page.tsx
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Check,
  Database,
  LockKeyhole,
  Monitor,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import {
  useThemeMode,
  type ThemeMode,
} from "@/components/layout/neuroedge-logo";
import { useRecordingCount, usePendingReviewCount } from "@/hooks/use-recording";

const sections = [
  { id: "general", label: "General preferences", icon: Settings2 },
  { id: "profile", label: "Operator profile", icon: UserRound },
  { id: "appearance", label: "Application appearance", icon: Monitor },
  { id: "storage", label: "Local storage", icon: Database },
  { id: "model", label: "Model configuration", icon: Activity },
  { id: "signal", label: "Signal processing", icon: SlidersHorizontal },
  { id: "sync", label: "Data synchronization", icon: RefreshCw },
  { id: "privacy", label: "Privacy & security", icon: ShieldCheck },
] as const;

type SectionId = (typeof sections)[number]["id"];

const modelDetails = [
  ["Model architecture", "NeuroEdge MLP (mlp-v1)"],
  ["Features", "28-channel DSP (DWT db4, Hjorth, TKEO, Entropy)"],
  ["Window size", "2.0s (512 samples @ 256 Hz)"],
  ["Default threshold", "0.6902 (5-window trailing average)"],
] as const;

function PreferenceRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-ne-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ne-fg">{title}</p>
        {description && (
          <p className="mt-1 text-xs leading-5 text-ne-fg-3">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange?: (next: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="min-w-36 rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-sm text-ne-fg outline-none transition focus:border-ne-cyan"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  defaultChecked = false,
  disabled = false,
}: {
  label: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => setChecked((value) => !value)}
      className={`relative h-6 w-11 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
        checked
          ? "border-ne-emerald/50 bg-ne-emerald/30"
          : "border-ne-line bg-ne-bg2"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-[21px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const [active, setActive] = useState<SectionId>("appearance");
  const [saved, setSaved] = useState(false);
  const section = sections.find((item) => item.id === active) ?? sections[0];
  const SectionIcon = section.icon;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={active === id ? "page" : undefined}
              onClick={() => {
                setActive(id);
                setSaved(false);
              }}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors lg:w-full ${
                active === id
                  ? "border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald"
                  : "border-ne-line bg-ne-card text-ne-fg-2 hover:text-ne-fg"
              }`}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          <Panel
            title={section.label}
            eyebrow="Workstation configuration"
            actions={
              <span className="grid size-9 place-items-center rounded-lg border border-ne-line bg-ne-bg2 text-ne-cyan">
                <SectionIcon aria-hidden="true" className="size-4" />
              </span>
            }
          >
            <div hidden={active !== "general"}>
              <GeneralPreferences />
            </div>
            <div hidden={active !== "profile"}>
              <UserProfile />
            </div>
            <div hidden={active !== "appearance"}>
              <Appearance />
            </div>
            <div hidden={active !== "storage"}>
              <OfflineStorage />
            </div>
            <div hidden={active !== "model"}>
              <ModelConfiguration />
            </div>
            <div hidden={active !== "signal"}>
              <SignalProcessing />
            </div>
            <div hidden={active !== "sync"}>
              <Synchronization />
            </div>
            <div hidden={active !== "privacy"}>
              <PrivacySecurity />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ne-line pt-4">
              <button
                type="button"
                onClick={() => setSaved(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-2 text-xs font-medium text-ne-emerald transition-colors hover:bg-ne-emerald/20"
              >
                <Check aria-hidden="true" className="size-3.5" />
                Save preferences
              </button>
              {saved && (
                <span role="status" className="text-xs text-ne-emerald">
                  Preferences saved.
                </span>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function GeneralPreferences() {
  const [landing, setLanding] = useState("EEG Workspace");
  const [timeFmt, setTimeFmt] = useState("Relative time");
  return (
    <div>
      <PreferenceRow
        title="Default landing view"
        description="Initial screen loaded on startup."
      >
        <SelectControl
          label="Default landing page"
          value={landing}
          onChange={setLanding}
          options={["EEG Workspace", "Recordings", "AI Screening"]}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Timestamp format"
        description="Format used across event timelines and waveform axes."
      >
        <SelectControl
          label="Time display"
          value={timeFmt}
          onChange={setTimeFmt}
          options={["Relative time", "Clock time", "Both"]}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Restore active recording"
        description="Automatically reopen the last active EDF session."
      >
        <Toggle label="Restore active recording" defaultChecked />
      </PreferenceRow>
      <PreferenceRow
        title="Keyboard shortcuts"
        description="Enable hotkeys for timeline scrubbing and event marking."
      >
        <Toggle label="Keyboard shortcuts" defaultChecked />
      </PreferenceRow>
    </div>
  );
}

function UserProfile() {
  const [role, setRole] = useState("Clinical reviewer");
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-ne-line bg-ne-bg2 p-4">
        <div className="grid size-10 place-items-center rounded-full border border-ne-cyan/20 bg-ne-cyan/10 text-ne-cyan">
          <UserRound aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-ne-fg">Research Operator</p>
          <p className="mt-0.5 text-xs text-ne-fg-3">NeuroEdge Workstation</p>
        </div>
      </div>
      <PreferenceRow title="Operator name" description="Recorded on annotation logs.">
        <input
          aria-label="Display name"
          defaultValue="Research Operator"
          className="w-full rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-sm text-ne-fg outline-none focus:border-ne-cyan sm:w-48"
        />
      </PreferenceRow>
      <PreferenceRow title="Operator role">
        <SelectControl
          label="Review role"
          value={role}
          onChange={setRole}
          options={["Clinical reviewer", "Research reviewer", "Read-only"]}
        />
      </PreferenceRow>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useThemeMode();
  const [contrast, setContrast] = useState("Standard");

  const displayValue =
    theme === "light" ? "Light" : theme === "system" ? "System" : "Dark";

  const handleThemeSelect = (val: string) => {
    const mode: ThemeMode =
      val === "Light" ? "light" : val === "System" ? "system" : "dark";
    setTheme(mode);
  };

  return (
    <div>
      <PreferenceRow
        title="Color theme"
        description="Switch workstation interface between Dark, Light, or System theme."
      >
        <SelectControl
          label="Color theme"
          value={displayValue}
          onChange={handleThemeSelect}
          options={["Dark", "Light", "System"]}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Compact data tables"
        description="Increase row density in Recordings and Brain Data views."
      >
        <Toggle label="Compact data tables" />
      </PreferenceRow>
      <PreferenceRow
        title="Reduce motion"
        description="Minimize 3D cortex rotation and UI transitions."
      >
        <Toggle label="Reduce motion" />
      </PreferenceRow>
      <PreferenceRow
        title="Waveform contrast"
        description="Trace line thickness and contrast on the EEG canvas."
      >
        <SelectControl
          label="Waveform contrast"
          value={contrast}
          onChange={setContrast}
          options={["Standard", "High"]}
        />
      </PreferenceRow>
    </div>
  );
}

function OfflineStorage() {
  const recCount = useRecordingCount();
  const pendingCount = usePendingReviewCount();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Stored EDF files", String(recCount)],
          ["Pending review", String(pendingCount)],
          ["Storage engine", "IndexedDB"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-ne-line bg-ne-bg2 p-4"
          >
            <p className="font-mono text-lg text-ne-fg">{value}</p>
            <p className="mt-1 text-xs text-ne-fg-3">{label}</p>
          </div>
        ))}
      </div>
      <Link
        href="/repository"
        className="inline-flex items-center gap-2 text-xs text-ne-cyan hover:underline"
      >
        Manage repository records
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  );
}

function ModelConfiguration() {
  const [preset, setPreset] = useState("Balanced (0.69)");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {modelDetails.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-ne-line bg-ne-bg2 p-4"
          >
            <p className="text-[10px] uppercase tracking-wider text-ne-fg-3">
              {label}
            </p>
            <p className="mt-2 break-words font-mono text-sm text-ne-fg">
              {value}
            </p>
          </div>
        ))}
      </div>
      <PreferenceRow
        title="Operating threshold preset"
        description="Sensitivity vs. false-positive operating point from edge_model.json."
      >
        <SelectControl
          label="Operating threshold preset"
          value={preset}
          onChange={setPreset}
          options={[
            "High sensitivity (0.54)",
            "Balanced (0.69)",
            "Low alerts (0.77)",
            "Very low alerts (0.83)",
          ]}
        />
      </PreferenceRow>
    </div>
  );
}

function SignalProcessing() {
  const [hp, setHp] = useState("0.5 Hz");
  const [lp, setLp] = useState("45 Hz");
  const [notch, setNotch] = useState("50 Hz");
  const [gain, setGain] = useState("1.0x");
  return (
    <div>
      <PreferenceRow title="High-pass filter" description="Baseline drift removal cutoff.">
        <SelectControl
          label="High-pass filter"
          value={hp}
          onChange={setHp}
          options={["Off", "0.5 Hz", "1 Hz", "2 Hz"]}
        />
      </PreferenceRow>
      <PreferenceRow title="Low-pass filter" description="High-frequency muscle/EMG cutoff.">
        <SelectControl
          label="Low-pass filter"
          value={lp}
          onChange={setLp}
          options={["30 Hz", "45 Hz", "70 Hz", "Off"]}
        />
      </PreferenceRow>
      <PreferenceRow title="Notch filter" description="Powerline interference suppression.">
        <SelectControl
          label="Notch filter"
          value={notch}
          onChange={setNotch}
          options={["50 Hz", "60 Hz", "Off"]}
        />
      </PreferenceRow>
      <PreferenceRow title="Default amplitude scale">
        <SelectControl
          label="Default gain"
          value={gain}
          onChange={setGain}
          options={["0.5x", "1.0x", "2.0x", "5.0x"]}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Ocular & muscle artifact gating"
        description="Flag high frontal-to-posterior blink ratios automatically."
      >
        <Toggle label="Highlight artifacts" defaultChecked />
      </PreferenceRow>
    </div>
  );
}

function Synchronization() {
  const [syncMode, setSyncMode] = useState("Queue when online");
  return (
    <div className="space-y-4">
      <PreferenceRow
        title="Synchronization mode"
        description="Sync structured event metadata when network connectivity is available."
      >
        <SelectControl
          label="Synchronization mode"
          value={syncMode}
          onChange={setSyncMode}
          options={["Queue when online", "Manual"]}
        />
      </PreferenceRow>
    </div>
  );
}

function PrivacySecurity() {
  const [timeout, setTimeoutVal] = useState("30 minutes");
  return (
    <div>
      <PreferenceRow
        title="Pseudonymous identifiers"
        description="Strip patient PII from exported JSON and CSV research tables."
      >
        <Toggle label="Pseudonymous listings" defaultChecked disabled />
      </PreferenceRow>
      <PreferenceRow title="Session lock timeout">
        <SelectControl
          label="Session timeout"
          value={timeout}
          onChange={setTimeoutVal}
          options={["15 minutes", "30 minutes", "60 minutes"]}
        />
      </PreferenceRow>
      <div className="mt-4 flex gap-3 rounded-xl border border-ne-emerald/20 bg-ne-emerald/5 p-4">
        <LockKeyhole
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-ne-emerald"
        />
        <p className="text-xs leading-5 text-ne-fg-2">
          All raw EDF waveforms are processed locally on-device via IndexedDB.
        </p>
      </div>
    </div>
  );
}