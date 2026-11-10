'use client'

import { useState } from 'react'
import { Check, ChevronRight, CircleAlert, FileText, Flag, MousePointer2, Play, RotateCcw, ShieldAlert, Sparkles, X } from 'lucide-react'
import { Panel } from '@/components/layout/panel'

type EventKind = 'IED candidate' | 'Suspected seizure' | 'Artifact' | 'Review segment'

type ScreeningEvent = { time: string; seconds: number; kind: EventKind; duration: string; channels: string; confidence: string; quality: string; status: 'Model prediction' | 'Needs review' | 'Human reviewed' }

const events: ScreeningEvent[] = [
  { time: '00:18.42', seconds: 18.42, kind: 'IED candidate', duration: '0.8 s', channels: 'F7, T3, T5', confidence: '87%', quality: 'Good', status: 'Model prediction' },
  { time: '00:41.08', seconds: 41.08, kind: 'Artifact', duration: '4.2 s', channels: 'Fp1, Fp2', confidence: '—', quality: 'Poor', status: 'Needs review' },
  { time: '01:12.70', seconds: 72.7, kind: 'Suspected seizure', duration: '8.6 s', channels: 'C3, T3, T5', confidence: '74%', quality: 'Fair', status: 'Model prediction' },
  { time: '03:26.15', seconds: 206.15, kind: 'Review segment', duration: '12.0 s', channels: 'All channels', confidence: '—', quality: 'Fair', status: 'Needs review' },
]

function statusTone(kind: EventKind) {
  if (kind === 'IED candidate') return 'text-ne-amber border-ne-amber/30 bg-ne-amber/10'
  if (kind === 'Suspected seizure') return 'text-ne-ai border-ne-ai/30 bg-ne-ai/10'
  if (kind === 'Artifact') return 'text-ne-critical border-ne-critical/30 bg-ne-critical/10'
  return 'text-ne-cyan border-ne-cyan/30 bg-ne-cyan/10'
}

export function AiScreening() {
  const [selected, setSelected] = useState(events[0])
  const [running, setRunning] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<'Needs review' | 'Confirmed annotation' | 'Rejected'>('Needs review')
  const [note, setNote] = useState('')

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ne-ai/20 bg-ne-ai/5 px-4 py-3">
      <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ne-ai" /><div><p className="text-sm font-medium text-ne-fg">AI-assisted clinical review</p><p className="mt-1 text-xs text-ne-fg-2">Model outputs are screening candidates for qualified human review, not autonomous diagnoses.</p></div></div>
      <span className="rounded-full border border-ne-ai/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ne-ai">Human in the loop</span>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <Panel title="Screening overview" eyebrow="NE-DEMO-01 · selected recording">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[['Recording', 'NE-DEMO-01'], ['Model', 'NeuroEdge v0.4.2'], ['Quality', 'Good · 96%'], ['Duration', '05:14 · 19 ch']].map(([label, value]) => <div key={label} className="rounded-lg border border-ne-line bg-ne-bg2 p-3"><p className="text-[10px] uppercase tracking-wider text-ne-fg-3">{label}</p><p className="mt-2 font-mono text-xs text-ne-fg">{value}</p></div>)}
          </div>
          <div className="mt-4 rounded-lg border border-ne-line bg-ne-bg2/70 p-3"><div className="mb-2 flex justify-between text-xs"><span className="text-ne-fg-2">{running ? 'Processing candidate events…' : 'Processing complete'}</span><span className="font-mono text-ne-cyan">{running ? '68%' : '100%'}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-ne-elevated"><div className={`h-full rounded-full bg-ne-ai transition-all ${running ? 'w-[68%]' : 'w-full'}`} /></div></div>
        </Panel>

        <Panel title="Screening result" eyebrow="Model interpretation">
          <div className="flex flex-col gap-4 rounded-xl border border-ne-amber/30 bg-ne-amber/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 text-ne-amber" /><div><p className="font-medium text-ne-fg">Candidate epileptiform activity detected</p><p className="mt-1 max-w-xl text-xs leading-5 text-ne-fg-2">Review 2 model candidates and 1 suspected seizure-related segment. This result does not establish or exclude epilepsy.</p></div></div><span className="shrink-0 rounded-full border border-ne-amber/30 px-2.5 py-1 font-mono text-[10px] text-ne-amber">REVIEW REQUIRED</span></div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ne-fg-3"><span className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1">2 IED candidates</span><span className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1">1 suspected seizure</span><span className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1">1 artifact segment</span></div>
        </Panel>

        <Panel title="Event timeline" eyebrow="Click an event to inspect its waveform location" actions={<button className="inline-flex items-center gap-1.5 rounded-lg border border-ne-line px-2.5 py-1.5 text-xs text-ne-fg-2 hover:text-ne-fg"><Play className="h-3 w-3" />Preview</button>}>
          <div className="mb-4 flex items-center justify-between text-xs text-ne-fg-3"><span>00:00</span><span className="font-mono text-ne-cyan">Selected: {selected.time}</span><span>05:14</span></div>
          <div className="relative h-14 rounded-lg border border-ne-line bg-ne-bg2"><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ne-line" />{events.map((event) => <button key={event.time} aria-label={`Inspect ${event.kind} at ${event.time}`} onClick={() => setSelected(event)} className={`absolute top-1/2 h-9 w-2 -translate-y-1/2 rounded-full transition-transform hover:scale-125 ${event.kind === 'Artifact' ? 'bg-ne-critical' : event.kind === 'Suspected seizure' ? 'bg-ne-ai' : event.kind === 'IED candidate' ? 'bg-ne-amber' : 'bg-ne-cyan'} ${selected.time === event.time ? 'ring-2 ring-white ring-offset-2 ring-offset-ne-bg2' : ''}`} style={{ left: `${(event.seconds / 314) * 100}%` }} />)}</div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ne-fg-2"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-amber" />Candidate IED</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-ai" />Suspected seizure</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-critical" />Artifact</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ne-cyan" />Review segment</span></div>
          <div className="mt-4 space-y-2">{events.map((event) => <button key={event.time} onClick={() => setSelected(event)} className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${selected.time === event.time ? 'border-ne-cyan/50 bg-ne-cyan/5' : 'border-ne-line bg-ne-bg2 hover:border-ne-cyan/30'}`}><div className="flex items-center gap-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${statusTone(event.kind)}`}>{event.kind}</span><span className="font-mono text-xs text-ne-fg">{event.time}</span><span className="hidden text-xs text-ne-fg-3 sm:inline">{event.channels}</span></div><ChevronRight className="h-4 w-4 text-ne-fg-3" /></button>)}</div>
        </Panel>
      </div>

      <Panel title="Event details" eyebrow="Human review controls">
        <div className="space-y-4">
          <div className={`rounded-lg border p-3 ${statusTone(selected.kind)}`}><div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4" />{selected.kind}</div><p className="mt-1 text-[11px] opacity-80">{selected.status}</p></div>
          <div className="grid grid-cols-2 gap-3 text-xs">{[['Timestamp', selected.time], ['Duration', selected.duration], ['Channels', selected.channels], ['Confidence', selected.confidence], ['Signal quality', selected.quality], ['Review status', reviewStatus]].map(([label, value]) => <div key={label}><p className="text-ne-fg-3">{label}</p><p className="mt-1 font-mono text-ne-fg">{value}</p></div>)}</div>
          <div className="border-t border-ne-line pt-4"><p className="mb-2 text-[10px] uppercase tracking-wider text-ne-fg-3">Annotation status</p><div className="grid gap-2"><button onClick={() => setReviewStatus('Needs review')} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${reviewStatus === 'Needs review' ? 'border-ne-amber/40 bg-ne-amber/10 text-ne-amber' : 'border-ne-line text-ne-fg-2'}`}><Flag className="h-3.5 w-3.5" />Mark for review</button><button onClick={() => setReviewStatus('Confirmed annotation')} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${reviewStatus === 'Confirmed annotation' ? 'border-ne-emerald/40 bg-ne-emerald/10 text-ne-emerald' : 'border-ne-line text-ne-fg-2'}`}><Check className="h-3.5 w-3.5" />Confirm annotation</button><button onClick={() => setReviewStatus('Rejected')} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${reviewStatus === 'Rejected' ? 'border-ne-critical/40 bg-ne-critical/10 text-ne-critical' : 'border-ne-line text-ne-fg-2'}`}><X className="h-3.5 w-3.5" />Reject candidate</button></div></div>
          <div><label htmlFor="clinical-note" className="mb-2 flex items-center gap-2 text-xs text-ne-fg-2"><FileText className="h-3.5 w-3.5" />Clinical note</label><textarea id="clinical-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note for the reviewing clinician…" className="min-h-24 w-full resize-y rounded-lg border border-ne-line bg-ne-bg2 p-3 text-xs text-ne-fg outline-none placeholder:text-ne-fg-3 focus:border-ne-cyan" /><button className="mt-2 inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3 py-2 text-xs text-ne-emerald"><MousePointer2 className="h-3.5 w-3.5" />Save note</button></div>
          <div className="rounded-lg border border-ne-line bg-ne-bg2/60 p-3 text-[11px] leading-5 text-ne-fg-3">Model predictions and human-reviewed annotations are stored as separate states. Confirming or rejecting a candidate does not alter the original recording.</div>
        </div>
      </Panel>
    </div>
  </div>
}
