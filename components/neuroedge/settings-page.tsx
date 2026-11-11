'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'
import { Panel } from '@/components/layout/panel'

const sections = [
  { id: 'general', label: 'General preferences', icon: Settings2 },
  { id: 'profile', label: 'User profile', icon: UserRound },
  { id: 'appearance', label: 'Application appearance', icon: Monitor },
  { id: 'storage', label: 'Offline storage', icon: Database },
  { id: 'model', label: 'Model configuration', icon: Activity },
  { id: 'signal', label: 'Signal processing', icon: SlidersHorizontal },
  { id: 'sync', label: 'Data synchronization', icon: RefreshCw },
  { id: 'privacy', label: 'Privacy & security', icon: ShieldCheck },
] as const

type SectionId = (typeof sections)[number]['id']

const modelDetails = [
  ['Model name', 'NeuroEdge IED Screening Model'],
  ['Version', 'v0.4.2'],
  ['Model size', '48.2 MB'],
  ['Input sampling frequency', '256 Hz EEG'],
  ['Last update', '2026-10-31'],
] as const

function PreferenceRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
      children: ReactNode

}) {
  return (
    <div className="flex flex-col gap-3 border-b border-ne-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ne-fg">{title}</p>
        {description && <p className="mt-1 text-xs leading-5 text-ne-fg-3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SelectControl({ label, value, options }: { label: string; value: string; options: string[] }) {
  return (
    <select
      aria-label={label}
      defaultValue={value}
      className="min-w-36 rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-sm text-ne-fg outline-none transition focus:border-ne-cyan"
    >
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  )
}

function Toggle({ label, defaultChecked = false, disabled = false }: { label: string; defaultChecked?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => setChecked((value) => !value)}
      className={`relative h-6 w-11 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${checked ? 'border-ne-emerald/50 bg-ne-emerald/30' : 'border-ne-line bg-ne-bg2'}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[21px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function SettingsPage() {
  const [active, setActive] = useState<SectionId>('general')
  const [applied, setApplied] = useState(false)
  const section = sections.find((item) => item.id === active) ?? sections[0]
  const SectionIcon = section.icon

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-ne-cyan/20 bg-ne-cyan/5 px-4 py-3 text-xs leading-5 text-ne-fg-2">
        These controls describe workstation preferences and sample model metadata. Changes are held in this session only; no setting is represented as saved to a server.
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={active === id ? 'page' : undefined}
              onClick={() => { setActive(id); setApplied(false) }}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors lg:w-full ${active === id ? 'border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald' : 'border-ne-line bg-ne-card text-ne-fg-2 hover:text-ne-fg'}`}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          <Panel title={section.label} eyebrow="Workstation settings" actions={<span className="grid size-9 place-items-center rounded-lg border border-ne-line bg-ne-bg2 text-ne-cyan"><SectionIcon aria-hidden="true" className="size-4" /></span>}>
            <div hidden={active !== 'general'}><GeneralPreferences /></div>
            <div hidden={active !== 'profile'}><UserProfile /></div>
            <div hidden={active !== 'appearance'}><Appearance /></div>
            <div hidden={active !== 'storage'}><OfflineStorage /></div>
            <div hidden={active !== 'model'}><ModelConfiguration /></div>
            <div hidden={active !== 'signal'}><SignalProcessing /></div>
            <div hidden={active !== 'sync'}><Synchronization /></div>
            <div hidden={active !== 'privacy'}><PrivacySecurity /></div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ne-line pt-4">
              <button
                type="button"
                onClick={() => setApplied(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-2 text-xs font-medium text-ne-emerald transition-colors hover:bg-ne-emerald/20"
              >
                <Check aria-hidden="true" className="size-3.5" />Apply for this session
              </button>
              {applied && <span role="status" className="text-xs text-ne-fg-3">Applied for the current session only.</span>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function GeneralPreferences() {
  return <div>
    <PreferenceRow title="Default landing page" description="Choose which workspace opens when you return."><SelectControl label="Default landing page" value="EEG Workspace" options={['EEG Workspace', 'Recordings', 'AI Screening']} /></PreferenceRow>
    <PreferenceRow title="Time display" description="Use a consistent timestamp format across event timelines."><SelectControl label="Time display" value="Relative time" options={['Relative time', 'Clock time', 'Both']} /></PreferenceRow>
    <PreferenceRow title="Keep last selected recording" description="Restore the last pseudonymous session in the workspace."><Toggle label="Keep last selected recording" defaultChecked /></PreferenceRow>
    <PreferenceRow title="Keyboard shortcuts" description="Enable shortcuts for playback and event navigation."><Toggle label="Keyboard shortcuts" defaultChecked /></PreferenceRow>
  </div>
}

function UserProfile() {
  return <div>
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-ne-line bg-ne-bg2 p-4">
      <div className="grid size-10 place-items-center rounded-full border border-ne-cyan/20 bg-ne-cyan/10 text-ne-cyan"><UserRound aria-hidden="true" className="size-5" /></div>
      <div><p className="text-sm font-medium text-ne-fg">Local reviewer</p><p className="mt-1 text-xs text-ne-fg-3">Profile fields are not connected to an identity provider.</p></div>
    </div>
    <PreferenceRow title="Display name" description="Shown in local review history only."><input aria-label="Display name" defaultValue="Local reviewer" className="w-full rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-sm text-ne-fg outline-none focus:border-ne-cyan sm:w-48" /></PreferenceRow>
    <PreferenceRow title="Review role"><SelectControl label="Review role" value="Clinical reviewer" options={['Clinical reviewer', 'Research reviewer', 'Read-only']} /></PreferenceRow>
    <p className="mt-3 text-xs leading-5 text-ne-fg-3">No patient identifiers or personal profile details are displayed in general recording listings.</p>
  </div>
}

function Appearance() {
  return <div>
    <PreferenceRow title="Color theme" description="Set the visual theme for this workstation."><SelectControl label="Color theme" value="Dark" options={['Dark', 'Light', 'System']} /></PreferenceRow>
    <PreferenceRow title="Compact data tables" description="Show more rows in the recordings and repository views."><Toggle label="Compact data tables" /></PreferenceRow>
    <PreferenceRow title="Reduce motion" description="Minimize animated transitions and live visual effects."><Toggle label="Reduce motion" /></PreferenceRow>
    <PreferenceRow title="Waveform contrast" description="Increase trace contrast against the EEG canvas."><SelectControl label="Waveform contrast" value="Standard" options={['Standard', 'High']} /></PreferenceRow>
  </div>
}

function OfflineStorage() {
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Local recordings", '16'], ['Pending sync', '3'], ['Offline cache', '1.4 GB']].map(([label, value]) => <div key={label} className="rounded-xl border border-ne-line bg-ne-bg2 p-4"><p className="font-mono text-lg text-ne-fg">{value}</p><p className="mt-1 text-xs text-ne-fg-3">{label}</p></div>)}
    </div>
    <div className="rounded-xl border border-ne-amber/20 bg-ne-amber/5 p-4">
      <p className="text-sm font-medium text-ne-fg">Offline queue remains available</p>
      <p className="mt-1 text-xs leading-5 text-ne-fg-3">Queued metadata is retained for synchronization when connectivity is restored. Original recordings are not modified by these preferences.</p>
    </div>
    <Link href="/repository" className="inline-flex items-center gap-2 text-xs text-ne-cyan hover:underline">Open repository queue<ArrowUpRight aria-hidden="true" className="size-3.5" /></Link>
  </div>
}

function ModelConfiguration() {
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      {modelDetails.map(([label, value]) => <div key={label} className="rounded-xl border border-ne-line bg-ne-bg2 p-4"><p className="text-[10px] uppercase tracking-wider text-ne-fg-3">{label}</p><p className="mt-2 break-words font-mono text-sm text-ne-fg">{value}</p></div>)}
    </div>
    <div className="rounded-xl border border-ne-cyan/20 bg-ne-cyan/5 p-4">
      <p className="text-xs font-medium text-ne-fg">Supported classification tasks</p>
      <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-ne-line bg-ne-card px-3 py-1.5 text-xs text-ne-fg-2">IED candidate screening</span><span className="rounded-full border border-ne-line bg-ne-card px-3 py-1.5 text-xs text-ne-fg-2">Artifact segmentation</span></div>
    </div>
    <p className="text-xs leading-5 text-ne-fg-3">Model metadata shown here is illustrative for the current workspace. Screening output is decision support and does not establish or exclude a clinical diagnosis.</p>
  </div>
}

function SignalProcessing() {
  return <div>
    <PreferenceRow title="High-pass filter" description="Display filter; source recording remains unchanged."><SelectControl label="High-pass filter" value="1 Hz" options={['Off', '0.5 Hz', '1 Hz', '2 Hz']} /></PreferenceRow>
    <PreferenceRow title="Low-pass filter" description="Display filter; source recording remains unchanged."><SelectControl label="Low-pass filter" value="45 Hz" options={['30 Hz', '45 Hz', '70 Hz', 'Off']} /></PreferenceRow>
    <PreferenceRow title="Notch filter"><SelectControl label="Notch filter" value="60 Hz" options={['Off', '50 Hz', '60 Hz']} /></PreferenceRow>
    <PreferenceRow title="Default gain"><SelectControl label="Default gain" value="1.0×" options={['0.5×', '1.0×', '2.0×', '5.0×']} /></PreferenceRow>
    <PreferenceRow title="Highlight artifacts" description="Mark artifact segments for review without changing source data."><Toggle label="Highlight artifacts" defaultChecked /></PreferenceRow>
  </div>
}

function Synchronization() {
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      {[["Local records", '16'], ['Pending uploads', '3'], ['Successful sync', '42'], ['Failed sync', '0']].map(([label, value]) => <div key={label} className="rounded-xl border border-ne-line bg-ne-bg2 p-4"><p className="font-mono text-lg text-ne-fg">{value}</p><p className="mt-1 text-xs text-ne-fg-3">{label}</p></div>)}
    </div>
    <PreferenceRow title="Synchronization mode" description="Local queue is retained while offline."><SelectControl label="Synchronization mode" value="Queue when online" options={['Queue when online', 'Manual']} /></PreferenceRow>
    <p className="text-xs text-ne-fg-3">Last successful sync: 2026-11-10 · 14:32 UTC</p>
  </div>
}

function PrivacySecurity() {
  return <div>
    <PreferenceRow title="Pseudonymous listings" description="Use recording identifiers in general views and exports."><Toggle label="Pseudonymous listings" defaultChecked disabled /></PreferenceRow>
    <PreferenceRow title="Require authorization for identity access" description="Identity access must be governed outside this interface."><Toggle label="Require authorization for identity access" defaultChecked disabled /></PreferenceRow>
    <PreferenceRow title="Session timeout"><SelectControl label="Session timeout" value="30 minutes" options={['15 minutes', '30 minutes', '60 minutes']} /></PreferenceRow>
    <div className="mt-4 flex gap-3 rounded-xl border border-ne-emerald/20 bg-ne-emerald/5 p-4">
      <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ne-emerald" />
      <p className="text-xs leading-5 text-ne-fg-2">Research exports remain pseudonymous by default. This interface does not expose patient identifiers or replace your organization&apos;s governance process.</p>
    </div>
  </div>
}
