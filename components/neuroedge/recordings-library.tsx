"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, Filter, Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const recordings = [
  { id: "REC-24-0817", date: "Oct 18, 2024 · 09:42", duration: "42m 18s", channels: 21, frequency: "256 Hz", quality: "Good", screening: "Screened", review: "Reviewed", events: 0 },
  { id: "REC-24-0816", date: "Oct 18, 2024 · 08:16", duration: "1h 08m", channels: 21, frequency: "256 Hz", quality: "Good", screening: "Candidate events", review: "Awaiting review", events: 3 },
  { id: "REC-24-0815", date: "Oct 17, 2024 · 16:03", duration: "28m 54s", channels: 19, frequency: "512 Hz", quality: "Fair", screening: "Screened", review: "Reviewed", events: 1 },
  { id: "REC-24-0814", date: "Oct 17, 2024 · 13:27", duration: "54m 12s", channels: 21, frequency: "256 Hz", quality: "Poor", screening: "Insufficient", review: "Needs attention", events: 0 },
  { id: "REC-24-0813", date: "Oct 17, 2024 · 10:11", duration: "36m 40s", channels: 21, frequency: "256 Hz", quality: "Good", screening: "Awaiting screening", review: "Not reviewed", events: 0 },
  { id: "REC-24-0812", date: "Oct 16, 2024 · 15:49", duration: "1h 22m", channels: 32, frequency: "512 Hz", quality: "Good", screening: "Candidate events", review: "Awaiting review", events: 7 },
  { id: "REC-24-0811", date: "Oct 16, 2024 · 11:05", duration: "18m 22s", channels: 19, frequency: "256 Hz", quality: "Fair", screening: "Screened", review: "Reviewed", events: 0 },
  { id: "REC-24-0810", date: "Oct 15, 2024 · 14:32", duration: "47m 05s", channels: 21, frequency: "256 Hz", quality: "Good", screening: "Candidate events", review: "Awaiting review", events: 2 },
]

const filters = ["All recordings", "Screened", "Awaiting review", "Candidate events", "Poor-quality"]

type Recording = (typeof recordings)[number]

function QualityBadge({ value }: { value: Recording["quality"] }) {
  return <Badge variant="outline" className={cn("border-0 font-medium", value === "Good" ? "bg-emerald-500/10 text-emerald-400" : value === "Fair" ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400")}>{value}</Badge>
}

function StatusBadge({ value }: { value: string }) {
  const candidate = value === "Candidate events"
  const awaiting = value === "Awaiting review" || value === "Awaiting screening"
  const poor = value === "Insufficient" || value === "Needs attention"
  return <Badge variant="outline" className={cn("border-0 font-medium", candidate ? "bg-amber-500/10 text-amber-400" : poor ? "bg-rose-500/10 text-rose-400" : awaiting ? "bg-sky-500/10 text-sky-400" : "bg-emerald-500/10 text-emerald-400")}>{value}</Badge>
}

export function RecordingsLibrary() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All recordings")
  const [sort, setSort] = useState<keyof Recording>("date")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const next = recordings.filter((recording) => {
      const matchesQuery = `${recording.id} ${recording.date}`.toLowerCase().includes(query.toLowerCase())
      const matchesFilter = activeFilter === "All recordings" || activeFilter === "Screened" && recording.screening === "Screened" || activeFilter === "Awaiting review" && recording.review === "Awaiting review" || activeFilter === "Candidate events" && recording.screening === "Candidate events" || activeFilter === "Poor-quality" && recording.quality === "Poor"
      return matchesQuery && matchesFilter
    })
    return [...next].sort((a, b) => String(a[sort]).localeCompare(String(b[sort])))
  }, [activeFilter, query, sort])

  const visible = filtered.slice((page - 1) * 6, page * 6)
  const totalPages = Math.max(1, Math.ceil(filtered.length / 6))

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">NeuroEdge / Library</p>
            <h1 className="text-2xl font-semibold tracking-tight">Recordings management</h1>
            <p className="mt-1 text-sm text-muted-foreground">Search, triage, and route pseudonymous EEG recordings for review.</p>
          </div>
          <Button onClick={() => router.push("/workspace")} className="w-fit gap-2"><ExternalLink className="size-4" />Open EEG Workspace</Button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[{ label: "Total recordings", value: "248", tone: "text-foreground" }, { label: "Awaiting review", value: "18", tone: "text-amber-400" }, { label: "Candidate events", value: "31", tone: "text-sky-400" }, { label: "Quality flagged", value: "7", tone: "text-rose-400" }].map((stat) => <div key={stat.label} className="rounded-xl border border-border/70 bg-card/70 p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p><p className={cn("mt-2 text-2xl font-semibold", stat.tone)}>{stat.value}</p></div>)}
        </div>

        <section className="rounded-2xl border border-border/70 bg-card/55 shadow-2xl shadow-black/10">
          <div className="border-b border-border/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search recording ID or date" className="border-border/80 bg-background/70 pl-9" /></div>
              <div className="flex items-center gap-2"><Select value={sort} onValueChange={(value) => setSort(value as keyof Recording)}><SelectTrigger className="w-[154px] bg-background/70"><SlidersHorizontal className="mr-2 size-3.5" /><SelectValue placeholder="Sort by" /></SelectTrigger><SelectContent><SelectItem value="date">Sort by date</SelectItem><SelectItem value="duration">Sort by duration</SelectItem><SelectItem value="quality">Sort by quality</SelectItem><SelectItem value="screening">Sort by status</SelectItem></SelectContent></Select><Button variant="outline" size="icon" aria-label="Open filters"><Filter className="size-4" /></Button></div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{filters.map((filter) => <button key={filter} onClick={() => { setActiveFilter(filter); setPage(1) }} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", activeFilter === filter ? "border-primary/40 bg-primary/10 text-primary" : "border-border/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>{filter}</button>)}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm"><thead className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{[{ key: "id", label: "Recording ID" }, { key: "date", label: "Date" }, { key: "duration", label: "Duration" }, { key: "channels", label: "Channels" }, { key: "frequency", label: "Sampling" }, { key: "quality", label: "Quality" }, { key: "screening", label: "Screening" }, { key: "review", label: "Review status" }].map((column) => <th key={column.key} className="px-4 py-3 font-medium"><button onClick={() => setSort(column.key as keyof Recording)} className="inline-flex items-center gap-1.5 hover:text-foreground">{column.label}<ArrowUpDown className="size-3" /></button></th>)}<th className="px-4 py-3 font-medium">Actions</th></tr></thead><tbody className="divide-y divide-border/50">{visible.map((recording) => <tr key={recording.id} className="transition-colors hover:bg-muted/20"><td className="px-4 py-4 font-mono text-xs text-foreground">{recording.id}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{recording.date}</td><td className="px-4 py-4 tabular-nums">{recording.duration}</td><td className="px-4 py-4 tabular-nums">{recording.channels}</td><td className="px-4 py-4 text-muted-foreground">{recording.frequency}</td><td className="px-4 py-4"><QualityBadge value={recording.quality} /></td><td className="px-4 py-4"><StatusBadge value={recording.screening} /></td><td className="px-4 py-4"><StatusBadge value={recording.review} /></td><td className="px-4 py-4"><Button size="sm" variant="ghost" className="gap-1.5 text-primary hover:text-primary" onClick={() => router.push(`/workspace?recording=${recording.id}`)}>Open <ExternalLink className="size-3.5" /></Button></td></tr>)}</tbody></table>
            {visible.length === 0 && <div className="px-6 py-14 text-center text-sm text-muted-foreground">No recordings match this search.</div>}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {filtered.length === 0 ? 0 : (page - 1) * 6 + 1}–{Math.min(page * 6, filtered.length)} of {filtered.length} recordings</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button><span className="min-w-16 text-center">Page {page} of {totalPages}</span><Button variant="outline" size="icon" className="size-8" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button></div></div>
        </section>
      </div>
    </main>
  )
}
