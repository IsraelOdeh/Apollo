// components/neuroedge/model-info-page.tsx
"use client";

import {
  Activity,
  ArrowRight,
  Ban,
  CheckCircle2,
  Cpu,
  HardDrive,
  Lock,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { EDGE_MODEL } from "@/lib/eeg/edge-screening";
import { INTENDED_USE_SPEC } from "@/lib/privacy/workstation-policy";

/**
 * Technical specification cards derived directly from lib/eeg/edge_model.json.
 */
const MODEL_SPECS = [
  ["Architecture", `3-Layer MLP (${EDGE_MODEL.format})`],
  ["Model footprint", "~55 KB JSON (browser-native)"],
  ["Input sampling", "256 Hz · 2.0 s windows (512 samples)"],
  ["Feature vector", `${EDGE_MODEL.featureNames.length} channel-agnostic DSP features`],
  ["Smoothing", `${EDGE_MODEL.smoothing?.windows ?? 5}-window trailing mean`],
  ["Default threshold", `${EDGE_MODEL.threshold.toFixed(2)} (Balanced FPR 0.02)`],
] as const;

/**
 * On-device signal-to-decision flow proving zero outbound neurodata leaves the browser.
 */
const DATA_FLOW_STEPS = [
  {
    step: "1. Recording",
    label: "Local EDF / EDF+",
    detail: "Parsed directly in browser memory via edfcore.",
  },
  {
    step: "2. DSP Features",
    label: "28 Signal Features",
    detail: "DWT db4, Hjorth, TKEO, spectral entropy, blink ratio.",
  },
  {
    step: "3. Model Estimate",
    label: "Local MLP + Abstain",
    detail: "Flags candidates or abstains on unreliable contact.",
  },
  {
    step: "4. Human Action",
    label: "Clinician Review",
    detail: "Reviewer confirms, rejects, or purges local session.",
  },
] as const;

export function ModelInfoPage() {
  return (
    <div className="space-y-5">
      {/* 1. Unified Intended Use & Excluded Uses (matches README.md & pitch) */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Intended use"
          eyebrow="Scope · aligned with README & deployment policy"
          actions={<CheckCircle2 className="size-4 text-ne-emerald" />}
        >
          <p className="text-sm leading-6 text-ne-fg">
            {INTENDED_USE_SPEC.intendedUse}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {MODEL_SPECS.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-ne-line bg-ne-bg2 p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-ne-fg-3">
                  {label}
                </p>
                <p className="mt-1.5 font-mono text-xs text-ne-fg">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Excluded uses"
          eyebrow="Hard operational boundaries"
          actions={<Ban className="size-4 text-ne-critical" />}
        >
          <ul className="space-y-3 text-sm text-ne-fg-2">
            {INTENDED_USE_SPEC.excludedUses.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 rounded-xl border border-ne-line bg-ne-bg2 p-3"
              >
                <Ban className="mt-0.5 size-4 shrink-0 text-ne-critical" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl border border-ne-cyan/25 bg-ne-cyan/5 p-3.5 text-xs leading-5 text-ne-fg-2">
            <strong className="text-ne-fg">Human authority:</strong>{" "}
            {INTENDED_USE_SPEC.accountability.humanAuthority}
          </div>
        </Panel>
      </div>

      {/* 2. On-Device Signal-to-Decision Data Flow Map */}
      <Panel
        title="Signal-to-decision data flow"
        eyebrow="Privacy by design · NDPA 2023 / NDPC 2025 aligned"
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ne-emerald/30 bg-ne-emerald/10 px-2.5 py-1 font-mono text-[10px] text-ne-emerald">
            <Lock className="size-3" />
            ZERO OUTBOUND RAW EEG
          </span>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          {DATA_FLOW_STEPS.map((node, index) => (
            <div key={node.step} className="relative flex items-stretch gap-2">
              <div className="flex-1 rounded-xl border border-ne-line bg-ne-bg2 p-3.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ne-cyan">
                  {node.step}
                </p>
                <p className="mt-1 text-sm font-semibold text-ne-fg">
                  {node.label}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-ne-fg-3">
                  {node.detail}
                </p>
              </div>
              {index < DATA_FLOW_STEPS.length - 1 && (
                <div className="hidden items-center text-ne-fg-3 md:flex">
                  <ArrowRight className="size-4" />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-ne-fg-3">
          <HardDrive className="size-3.5 shrink-0 text-ne-emerald" />
          All raw EDF waveforms, derived DSP features, and review annotations
          stay inside browser IndexedDB unless explicitly exported by the
          operator.
        </p>
      </Panel>

      {/* 3. Evaluation, Error Profile & Abstention */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Evaluation & errors that matter"
          eyebrow="Patient-wise testing & abstention"
          actions={<Activity className="size-4 text-ne-cyan" />}
        >
          <ul className="space-y-3 text-xs leading-5 text-ne-fg-2">
            {INTENDED_USE_SPEC.evaluationSummary.map((line) => (
              <li
                key={line}
                className="rounded-xl border border-ne-line bg-ne-bg2 p-3"
              >
                {line}
              </li>
            ))}
          </ul>

          {/* Error Modes Table */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-ne-line bg-ne-bg2">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-ne-line text-[10px] uppercase tracking-wider text-ne-fg-3">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Failure Mode</th>
                  <th className="px-3 py-2.5 font-medium">Safeguard Built In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ne-line/60 text-ne-fg-2">
                <tr>
                  <td className="px-3 py-2.5 font-medium text-ne-fg">
                    Eye blinks / EMG bursts
                  </td>
                  <td className="px-3 py-2.5">
                    Frontal-to-posterior RMS ratio gates ocular artifacts before
                    flagging seizures.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-medium text-ne-fg">
                    Loose lead / flatline / saturation
                  </td>
                  <td className="px-3 py-2.5">
                    Model emits <span className="font-mono text-ne-fg">Abstained</span>{" "}
                    instead of guessing on corrupted traces.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 font-medium text-ne-fg">
                    Low-amplitude focal events
                  </td>
                  <td className="px-3 py-2.5">
                    Focal crest ratio &amp; borderline tier prompt manual review
                    in EEG Workspace.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        {/* 4. Real-World Deployment Gaps & Governance */}
        <Panel
          title="Unresolved gaps & accountability"
          eyebrow="Before clinical deployment"
          actions={<AlertTriangle className="size-4 text-ne-amber" />}
        >
          <ul className="space-y-3 text-xs leading-5 text-ne-fg-2">
            {INTENDED_USE_SPEC.knownGapsBeforeClinicalUse.map((gap) => (
              <li
                key={gap}
                className="flex items-start gap-2.5 rounded-xl border border-ne-line bg-ne-bg2 p-3"
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ne-amber" />
                <span>{gap}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2.5 rounded-xl border border-ne-line bg-ne-bg2 p-3.5 text-xs leading-5 text-ne-fg-2">
            <div className="flex items-center gap-2 font-medium text-ne-fg">
              <UserCheck className="size-4 text-ne-emerald" />
              Change-review &amp; stop authority
            </div>
            <p>{INTENDED_USE_SPEC.accountability.changeReviewTriggers}</p>
            <p className="text-ne-fg-3">
              <Cpu className="mr-1.5 inline size-3.5 text-ne-cyan" />
              Model artifact: <span className="font-mono">lib/eeg/edge_model.json</span>
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}