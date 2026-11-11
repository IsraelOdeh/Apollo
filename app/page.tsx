import { BrainPanel } from "@/components/dashboard/brain-panel";
import { EegActivityPanel } from "@/components/dashboard/eeg-activity-panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScreeningOverviewPanel } from "@/components/dashboard/screening-overview-panel";
import { DEMO_KPIS } from "@/lib/demo/dashboard-data";
import BrainViewer from "@/components/brain/BrainViewer";

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-ne-fg-2">
          Live-looking overview of acquisition, screening and synchronization.
          All values shown are demonstration data, not patient records.
        </p>
        <span className="rounded-full border border-ne-line bg-ne-card px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ne-fg-2">
          Demonstration data
        </span>
      </div>

      {/* <div className="grid gap-4 xl:grid-cols-12">
        <div className="min-h-[560px] xl:col-span-7"> */}
      {/* <BrainPanel /> */}
      <BrainViewer />
      {/* </div> */}
      {/* </div> */}
      {/* <div className="grid gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-5"> */}
      {/* <EegActivityPanel /> */}
      <ScreeningOverviewPanel />
      {/* </div> */}
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-5">
        {DEMO_KPIS.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>
      {/* </div> */}
    </div>
  );
}
