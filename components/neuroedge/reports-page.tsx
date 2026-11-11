'use client'

import { useMemo, useState } from 'react'
import { Activity, BadgeCheck, ChartNoAxesColumn, CircleAlert, Download, FileSpreadsheet, FileText, Filter, Gauge, History, SlidersHorizontal } from 'lucide-react'
import { Panel } from '@/components/layout/panel'

type ReportRow = { id: string; date: string; screened: number; candidates: number; quality: string; confirmed: number }

const sessions: ReportRow[] = [
  { id: 'NE-7F2A-91C4', date: 'Nov 08, 2026', screened: 18, candidates: 6, quality: 'Good', confirmed: 2 },
  { id: 'NE-2B6D-40A8', date: 'Nov 07, 2026', screened: 12, candidates: 3, quality: 'Fair', confirmed: 1 },
  { id: 'NE-9C13-72E1', date: 'Nov 06, 2026', screened: 24, candidates: 9, quality: 'Good', confirmed: 4 },
  { id: 'NE-5A80-36F2', date: 'Nov 05, 2026', screened: 8, candidates: 2, quality: 'Limited', confirmed: 0 },
]

const distribution = [
  { name: 'Candidate IED', count: 20, color: 'bg-ne-ai', note: 'Model-generated' },
  { name: 'Artifact', count: 14, color: 'bg-ne-amber', note: 'Signal quality' },
  { name: 'Review needed', count: 8, color: 'bg-ne-cyan', note: 'Unresolved' },
]

function ActionButton({ children, onClick, quiet = false }: { children: React.ReactNode; onClick: () => void; quiet?: boolean }) {
  return <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${quiet ? 'border-ne-line bg-ne-bg2 text-ne-fg-2 hover:text-ne-fg' : 'border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald hover:bg-ne-emerald/20'}`}>{children}</button>
}

export function ReportsPage() {
  const [range, setRange] = useState('Last 30 days')
  const [qualityFilter, setQualityFilter] = useState('All quality')
  const filtered = useMemo(() => sessions.filter((row) => qualityFilter === 'All quality' || row.quality === qualityFilter), [qualityFilter])
  const csv = useMemo(() => {
    const header = ['recording_id', 'date', 'screened_segments', 'model_candidates', 'recording_quality', 'human_confirmed_annotations']
    return [header.join(','), ...filtered.map((row) => [row.id, row.date, row.screened, row.candidates, row.quality, row.confirmed].join(','))].join('\n')
  }, [filtered])
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'neuroedge-screening-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div className="space-y-5 pb-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ne-line bg-ne-card/70 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ne-fg-2"><span className="font-mono uppercase tracking-wider text-ne-fg-3">Report period</span><select aria-label="Report period" value={range} onChange={(event) => setRange(event.target.value)} className="rounded-lg border border-ne-line bg-ne-bg2 px-3 py-2 text-xs text-ne-fg outline-none focus:border-ne-cyan"><option>Last 30 days</option><option>Last 7 days</option><option>All sessions</option></select><span className="hidden text-ne-fg-3 sm:inline">Updated Nov 11, 2026 · Local demo cohort</span></div>
      <div className="flex gap-2"><ActionButton quiet onClick={() => window.print()}><FileText className="size-3.5" />Export PDF</ActionButton><ActionButton onClick={exportCsv}><FileSpreadsheet className="size-3.5" />Export CSV</ActionButton></div>
    </div>

    <section aria-label="Screening summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Sessions screened', value: '16', sub: 'Across selected period', icon: Activity, tone: 'text-ne-cyan' },
        { label: 'Model candidates', value: '42', sub: 'Require human review', icon: CircleAlert, tone: 'text-ne-ai' },
        { label: 'Review completed', value: '18', sub: 'Human annotations', icon: BadgeCheck, tone: 'text-ne-emerald' },
        { label: 'Recording quality', value: '87%', sub: 'Good or acceptable', icon: Gauge, tone: 'text-ne-amber' },
      ].map(({ label, value, sub, icon: Icon, tone }) => <article key={label} className="rounded-xl border border-ne-line bg-ne-card/90 p-4"><div className="flex items-center justify-between"><span className="text-xs text-ne-fg-2">{label}</span><Icon className={`size-4 ${tone}`} /></div><p className="mt-3 font-mono text-2xl font-medium tracking-tight text-ne-fg">{value}</p><p className="mt-1 text-[11px] text-ne-fg-3">{sub}</p></article>)}
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel title="Screening summary" eyebrow="Model output · 16 sessions" actions={<span className="rounded-full border border-ne-ai/20 bg-ne-ai/10 px-2.5 py-1 font-mono text-[10px] text-ne-ai">MODEL FINDINGS</span>}>
        <div className="grid gap-3 sm:grid-cols-3">
          {[['42', 'Candidate events', 'Across recordings'], ['6', 'Sessions with candidates', 'Model flagged'], ['18', 'Human annotations', 'Reviewed separately']].map(([value, label, detail]) => <div key={label} className="rounded-lg border border-ne-line bg-ne-bg2 p-3"><p className="font-mono text-xl text-ne-fg">{value}</p><p className="mt-1 text-xs text-ne-fg-2">{label}</p><p className="mt-1 text-[10px] text-ne-fg-3">{detail}</p></div>)}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-ne-amber/20 bg-ne-amber/5 p-3 text-[11px] leading-5 text-ne-fg-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-ne-amber" /><p>Screening candidates are model-generated findings, not diagnoses. A model result with no candidate does not rule out epilepsy; clinical interpretation remains with qualified reviewers.</p></div>
      </Panel>

      <Panel title="Candidate event distribution" eyebrow="42 total · model-generated">
        <div className="flex h-3 overflow-hidden rounded-full bg-ne-elevated" role="img" aria-label="Event distribution: 20 candidate IED, 14 artifact, 8 requiring review">{distribution.map((item) => <div key={item.name} className={item.color} style={{ width: `${item.count / 42 * 100}%` }} />)}</div>
        <div className="mt-4 flex flex-col gap-3">{distribution.map((item) => <div key={item.name} className="flex items-center gap-3"><span className={`size-2.5 shrink-0 rounded-sm ${item.color}`} /><span className="min-w-0 flex-1 text-xs text-ne-fg-2">{item.name}<span className="ml-2 text-[10px] text-ne-fg-3">{item.note}</span></span><span className="font-mono text-xs text-ne-fg">{item.count}</span><span className="w-9 text-right font-mono text-[10px] text-ne-fg-3">{Math.round(item.count / 42 * 100)}%</span></div>)}</div>
      </Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Panel title="Recording quality summary" eyebrow="Signal integrity">
        <div className="grid grid-cols-3 gap-2">{[['Good', '11', 'text-ne-emerald', 'bg-ne-emerald'], ['Fair', '3', 'text-ne-amber', 'bg-ne-amber'], ['Limited', '2', 'text-ne-critical', 'bg-ne-critical']].map(([label, value, text, bar]) => <div key={label} className="rounded-lg border border-ne-line bg-ne-bg2 p-3"><p className={`text-[11px] ${text}`}>{label}</p><p className="mt-2 font-mono text-xl text-ne-fg">{value}</p><div className="mt-3 h-1 overflow-hidden rounded bg-ne-elevated"><div className={`h-full ${bar}`} style={{ width: `${Number(value) / 16 * 100}%` }} /></div></div>)}</div>
        <p className="mt-3 text-[10px] leading-4 text-ne-fg-3">Quality reflects signal usability for screening and may limit confidence. It is not a clinical severity measure.</p>
      </Panel>

      <Panel title="Model performance metrics" eyebrow="Validation cohort · model v0.4.2" actions={<span className="inline-flex items-center gap-1 text-[10px] text-ne-emerald"><span className="size-1.5 rounded-full bg-ne-emerald" />Validation snapshot</span>}>
        <div className="grid grid-cols-2 gap-3">{[['Sensitivity', '0.91', '95% CI 0.84–0.96'], ['Specificity', '0.88', '95% CI 0.81–0.93'], ['Precision', '0.82', '95% CI 0.74–0.89'], ['F1 score', '0.86', 'Validation set']].map(([label, value, detail]) => <div key={label} className="flex items-center justify-between gap-2 rounded-lg border border-ne-line bg-ne-bg2 p-3"><div><p className="text-[11px] text-ne-fg-2">{label}</p><p className="mt-1 text-[9px] text-ne-fg-3">{detail}</p></div><span className="font-mono text-lg text-ne-cyan">{value}</span></div>)}</div>
        <p className="mt-3 text-[10px] leading-4 text-ne-fg-3">Metrics are from a labeled validation cohort; they do not predict an individual patient&apos;s diagnosis or outcome.</p>
      </Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Signal-processing configuration" eyebrow="Applied screening pipeline" actions={<SlidersHorizontal className="size-4 text-ne-fg-3" />}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">{[['High-pass', '1 Hz'], ['Low-pass', '45 Hz'], ['Notch', '60 Hz'], ['Montage', 'Longitudinal bipolar'], ['Sampling', '256 Hz'], ['Window', '10 seconds']].map(([key, value]) => <div key={key} className="flex items-center justify-between gap-2 border-b border-ne-line/70 pb-2"><span className="text-[11px] text-ne-fg-3">{key}</span><span className="font-mono text-[10px] text-ne-fg-2">{value}</span></div>)}</div>
        <p className="mt-3 text-[10px] text-ne-fg-3">Configuration describes the screening pipeline; imported source recordings remain unchanged.</p>
      </Panel>

      <Panel title="Annotation history" eyebrow="Human-reviewed activity" actions={<span className="inline-flex items-center gap-1 text-[10px] text-ne-fg-3"><History className="size-3" />Audit trail</span>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left"><thead><tr className="border-b border-ne-line text-[9px] uppercase tracking-wider text-ne-fg-3"><th className="pb-2 font-medium">Recording</th><th className="pb-2 font-medium">Model finding</th><th className="pb-2 font-medium">Human annotation</th><th className="pb-2 text-right font-medium">Status</th></tr></thead><tbody>{[
          ['NE-7F2A-91C4', 'IED candidate × 2', 'Confirmed × 1', 'Reviewed'],
          ['NE-2B6D-40A8', 'IED candidate × 1', 'Rejected × 1', 'Reviewed'],
          ['NE-9C13-72E1', 'IED candidate × 4', 'In review × 2', 'Partial'],
        ].map(([id, finding, note, status]) => <tr key={id} className="border-b border-ne-line/60 last:border-0"><td className="py-3 font-mono text-[10px] text-ne-cyan">{id}</td><td className="py-3 text-[10px] text-ne-ai">{finding}</td><td className="py-3 text-[10px] text-ne-fg-2">{note}</td><td className="py-3 text-right"><span className={`rounded-full px-2 py-1 text-[9px] ${status === 'Reviewed' ? 'bg-ne-emerald/10 text-ne-emerald' : 'bg-ne-amber/10 text-ne-amber'}`}>{status}</span></td></tr>)}</tbody></table></div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-ne-fg-3"><ChartNoAxesColumn className="size-3.5 text-ne-ai" /><span>Model-generated findings</span><span className="ml-2 size-1 rounded-full bg-ne-emerald" /><span>Human-reviewed annotations are recorded separately</span></div>
      </Panel>
    </div>

    <Panel title="Screening session records" eyebrow={`${filtered.length} pseudonymous sessions`} actions={<label className="flex items-center gap-2 text-[10px] text-ne-fg-3"><Filter className="size-3" /><select aria-label="Filter by recording quality" value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)} className="rounded-md border border-ne-line bg-ne-bg2 px-2 py-1.5 text-[10px] text-ne-fg"><option>All quality</option><option>Good</option><option>Fair</option><option>Limited</option></select></label>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-ne-line text-[9px] uppercase tracking-wider text-ne-fg-3"><th className="pb-3 font-medium">Recording ID</th><th className="pb-3 font-medium">Date</th><th className="pb-3 text-right font-medium">Segments</th><th className="pb-3 text-right font-medium">Model candidates</th><th className="pb-3 text-right font-medium">Recording quality</th><th className="pb-3 text-right font-medium">Human reviewed</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-b border-ne-line/60 last:border-0"><td className="py-3 font-mono text-[11px] text-ne-cyan">{row.id}</td><td className="py-3 text-[11px] text-ne-fg-2">{row.date}</td><td className="py-3 text-right font-mono text-[11px] text-ne-fg-2">{row.screened}</td><td className="py-3 text-right font-mono text-[11px] text-ne-ai">{row.candidates}</td><td className="py-3 text-right"><span className={`rounded-full px-2 py-1 text-[9px] ${row.quality === 'Good' ? 'bg-ne-emerald/10 text-ne-emerald' : row.quality === 'Fair' ? 'bg-ne-amber/10 text-ne-amber' : 'bg-ne-critical/10 text-ne-critical'}`}>{row.quality}</span></td><td className="py-3 text-right font-mono text-[11px] text-ne-fg-2">{row.confirmed} confirmed</td></tr>)}</tbody></table></div>
    </Panel>
    <p className="px-1 text-[10px] leading-5 text-ne-fg-3">Research demo summary using pseudonymous recording identifiers. Screening outputs are decision support only and must not be treated as confirmed clinical interpretations.</p>
  </div>
}
