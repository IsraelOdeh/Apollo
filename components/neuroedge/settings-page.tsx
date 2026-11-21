// components/neuroedge/settings-page.tsx
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  LockKeyhole,
  Monitor,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import {
  useThemeMode,
  type ThemeMode,
} from "@/components/layout/neuroedge-logo";
import {
  useRecordingCount,
  usePendingReviewCount,
} from "@/hooks/use-recording";
import {
  purgeAllLocalNeuroData,
  useWorkstationPolicy,
  type ViewRole,
} from "@/lib/privacy/workstation-policy";
import { EDGE_MODEL } from "@/lib/eeg/edge-screening";

const sections = [
  { id: "general", label: "General preferences", icon: Settings2 },
  { id: "profile", label: "Role & operator profile", icon: UserRound },
  { id: "appearance", label: "Application appearance", icon: Monitor },
  { id: "storage", label: "Local storage & purge", icon: Database },
  { id: "model", label: "Model configuration", icon: Activity },
  { id: "signal", label: "Signal processing", icon: SlidersHorizontal },
  { id: "sync", label: "Data synchronization", icon: RefreshCw },
  { id: "privacy", label: "Privacy & data flow", icon: ShieldCheck },
] as const;

type SectionId = (typeof sections)[number]["id"];

const PRESET_OPTIONS = (
  EDGE_MODEL.presets ?? [
    { label: "High sensitivity", threshold: 0.5441, FPR: 0.05 },
    { label: "Balanced", threshold: 0.6902, FPR: 0.02 },
    { label: "Low alerts", threshold: 0.7715, FPR: 0.01 },
    { label: "Very low alerts", threshold: 0.8332, FPR: 0.005 },
  ]
).map((p) => ({
  display: `${p.label} (${p.threshold.toFixed(2)})`,
  threshold: p.threshold,
}));

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
      className="min-w-44 rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-sm text-ne-fg outline-none transition focus:border-ne-cyan"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function ControlledToggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
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
  const [active, setActive] = useState<SectionId>("privacy");
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
                onClick={() => {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-2 text-xs font-medium text-ne-emerald transition-colors hover:bg-ne-emerald/20"
              >
                <Check aria-hidden="true" className="size-3.5" />
                Save preferences
              </button>
              {saved && (
                <span role="status" className="text-xs text-ne-emerald">
                  Preferences saved locally.
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
  const [restore, setRestore] = useState(true);
  const [hotkeys, setHotkeys] = useState(true);

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
        description="Reopen the last active local EDF session automatically."
      >
        <ControlledToggle
          label="Restore active recording"
          checked={restore}
          onChange={setRestore}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Keyboard shortcuts"
        description="Enable hotkeys for timeline scrubbing and annotation."
      >
        <ControlledToggle
          label="Keyboard shortcuts"
          checked={hotkeys}
          onChange={setHotkeys}
        />
      </PreferenceRow>
    </div>
  );
}

function UserProfile() {
  const { policy, updatePolicy } = useWorkstationPolicy();

  const roleLabel =
    policy.role === "education" ? "Caregiver / Education" : "Clinician";

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-ne-line bg-ne-bg2 p-4">
        <div className="grid size-10 place-items-center rounded-full border border-ne-cyan/20 bg-ne-cyan/10 text-ne-cyan">
          <UserRound aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-ne-fg">{policy.reviewerName}</p>
          <p className="mt-0.5 text-xs text-ne-fg-3">
            Active view: {roleLabel}
          </p>
        </div>
      </div>

      <PreferenceRow
        title="Reviewer name"
        description="Attributed to every confirmed or rejected event annotation."
      >
        <input
          aria-label="Reviewer name"
          value={policy.reviewerName}
          onChange={(e) => updatePolicy({ reviewerName: e.target.value })}
          className="w-full rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-sm text-ne-fg outline-none focus:border-ne-cyan sm:w-52"
        />
      </PreferenceRow>

      <PreferenceRow
        title="Output audience role"
        description="Clinician view exposes triage candidates & review actions. Education view shows plain-language cortical summaries without raw model flags."
      >
        <SelectControl
          label="Output audience role"
          value={roleLabel}
          onChange={(val) => {
            const nextRole: ViewRole =
              val === "Caregiver / Education" ? "education" : "clinician";
            updatePolicy({ role: nextRole });
          }}
          options={["Clinician", "Caregiver / Education"]}
        />
      </PreferenceRow>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useThemeMode();
  const [contrast, setContrast] = useState("Standard");
  const [compact, setCompact] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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
        <ControlledToggle
          label="Compact data tables"
          checked={compact}
          onChange={setCompact}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Reduce motion"
        description="Minimize 3D cortex rotation and UI transitions."
      >
        <ControlledToggle
          label="Reduce motion"
          checked={reduceMotion}
          onChange={setReduceMotion}
        />
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
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purgedNotice, setPurgedNotice] = useState(false);

  async function handlePurgeAll() {
    await purgeAllLocalNeuroData();
    setConfirmPurge(false);
    setPurgedNotice(true);
    setTimeout(() => setPurgedNotice(false), 3500);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Stored EDF files", String(recCount)],
          ["Pending review", String(pendingCount)],
          ["Storage engine", "Browser IndexedDB"],
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

      {/* Verifiable One-Click Erasure Control */}
      <div className="rounded-xl border border-ne-critical/25 bg-ne-critical/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ne-fg">
              End session &amp; purge local neurodata
            </p>
            <p className="mt-1 text-xs text-ne-fg-3">
              Permanently deletes all local EDF blobs, screening sessions,
              detected events, annotations, and reports from IndexedDB.
            </p>
          </div>
          {!confirmPurge ? (
            <button
              type="button"
              onClick={() => setConfirmPurge(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-ne-critical/40 bg-ne-critical/10 px-3 py-2 text-xs font-medium text-ne-critical hover:bg-ne-critical/20"
            >
              <Trash2 className="size-3.5" />
              Purge all local data
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handlePurgeAll}
                className="rounded-lg bg-ne-critical px-3 py-2 text-xs font-medium text-white hover:opacity-90"
              >
                Confirm permanent wipe
              </button>
              <button
                type="button"
                onClick={() => setConfirmPurge(false)}
                className="rounded-lg border border-ne-line px-3 py-2 text-xs text-ne-fg-2"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {purgedNotice && (
          <p role="status" className="mt-3 text-xs text-ne-emerald">
            All local recordings, events, and derived reports have been wiped.
          </p>
        )}
      </div>

      <Link
        href="/repository"
        className="inline-flex items-center gap-2 text-xs text-ne-cyan hover:underline"
      >
        Inspect repository records
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  );
}

function ModelConfiguration() {
  const { policy, updatePolicy } = useWorkstationPolicy();

  const modelDetails = [
    ["Model architecture", `NeuroEdge MLP (${EDGE_MODEL.format})`],
    ["Features", `${EDGE_MODEL.featureNames.length} channel-agnostic DSP features`],
    ["Window size", "2.0s (512 samples @ 256 Hz)"],
    [
      "Active threshold",
      `${policy.operatingThreshold.toFixed(4)} (${EDGE_MODEL.smoothing?.windows ?? 5}-win avg)`,
    ],
  ] as const;

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
        description="Applied on the next EDF screening run. Lower thresholds increase sensitivity; higher thresholds reduce false alerts."
      >
        <SelectControl
          label="Operating threshold preset"
          value={policy.thresholdLabel}
          onChange={(display) => {
            const match = PRESET_OPTIONS.find((p) => p.display === display);
            if (match) {
              updatePolicy({
                thresholdLabel: match.display,
                operatingThreshold: match.threshold,
              });
            }
          }}
          options={PRESET_OPTIONS.map((p) => p.display)}
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
  const [blinkGate, setBlinkGate] = useState(true);

  return (
    <div>
      <PreferenceRow
        title="High-pass filter"
        description="Baseline drift removal cutoff."
      >
        <SelectControl
          label="High-pass filter"
          value={hp}
          onChange={setHp}
          options={["Off", "0.5 Hz", "1 Hz", "2 Hz"]}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Low-pass filter"
        description="High-frequency muscle/EMG cutoff."
      >
        <SelectControl
          label="Low-pass filter"
          value={lp}
          onChange={setLp}
          options={["30 Hz", "45 Hz", "70 Hz", "Off"]}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Notch filter"
        description="Powerline interference suppression."
      >
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
        title="Ocular & poor-contact abstention gate"
        description="Gate high frontal-to-posterior blink ratios and abstain on flatlined/saturated leads."
      >
        <ControlledToggle
          label="Ocular & poor-contact abstention gate"
          checked={blinkGate}
          onChange={setBlinkGate}
        />
      </PreferenceRow>
    </div>
  );
}

function Synchronization() {
  const { policy, updatePolicy } = useWorkstationPolicy();

  return (
    <div className="space-y-4">
      <PreferenceRow
        title="Local-only execution (Sync OFF by default)"
        description="Blocks all automatic background uploads and hosted logging. Raw EEG never leaves this browser."
      >
        <ControlledToggle
          label="Local-only execution"
          checked={policy.localOnlyMode}
          onChange={(val) => updatePolicy({ localOnlyMode: val })}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Optional research metadata export"
        description="Declining keeps 100% of EDF inspection, 3D cortical mapping, and MLP screening fully usable."
      >
        <ControlledToggle
          label="Optional research metadata export"
          checked={policy.allowResearchExport}
          onChange={(val) => updatePolicy({ allowResearchExport: val })}
        />
      </PreferenceRow>
    </div>
  );
}

function PrivacySecurity() {
  const { policy, updatePolicy } = useWorkstationPolicy();
  const [timeout, setTimeoutVal] = useState("30 minutes");

  return (
    <div className="space-y-4">
      {/* Visual On-Device Data Flow Card */}
      <div className="rounded-xl border border-ne-emerald/25 bg-ne-emerald/5 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-ne-emerald">
          <LockKeyhole className="size-4" />
          Privacy by default (NDPA 2023 · NDPC 2025)
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ne-fg">
          <span className="rounded-md border border-ne-line bg-ne-card px-2.5 py-1">
            EDF File
          </span>
          <ArrowRight className="size-3.5 text-ne-fg-3" />
          <span className="rounded-md border border-ne-line bg-ne-card px-2.5 py-1">
            Local DSP (28 features)
          </span>
          <ArrowRight className="size-3.5 text-ne-fg-3" />
          <span className="rounded-md border border-ne-line bg-ne-card px-2.5 py-1">
            Local MLP + Abstain
          </span>
          <ArrowRight className="size-3.5 text-ne-fg-3" />
          <span className="rounded-md border border-ne-line bg-ne-card px-2.5 py-1">
            Clinician Review
          </span>
        </div>
        <p className="mt-2.5 text-xs leading-5 text-ne-fg-2">
          Zero raw EEG bytes leave this device. Verify in browser DevTools →
          Network tab during EDF screening.
        </p>
      </div>

      <PreferenceRow
        title="Local-only storage enforced"
        description="Disable all remote telemetry or cloud database writes."
      >
        <ControlledToggle
          label="Local-only storage enforced"
          checked={policy.localOnlyMode}
          onChange={(val) => updatePolicy({ localOnlyMode: val })}
        />
      </PreferenceRow>
      <PreferenceRow
        title="Pseudonymous export identifiers"
        description="Strip patient names and device IDs from CSV/PDF summaries. Derived EEG outputs still require controlled handling."
      >
        <ControlledToggle
          label="Pseudonymous export identifiers"
          checked
          disabled
        />
      </PreferenceRow>
      <PreferenceRow title="Session lock timeout">
        <SelectControl
          label="Session timeout"
          value={timeout}
          onChange={setTimeoutVal}
          options={["15 minutes", "30 minutes", "60 minutes"]}
        />
      </PreferenceRow>
    </div>
  );
}