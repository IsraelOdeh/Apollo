// app/page.tsx
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScreeningOverviewPanel } from "@/components/dashboard/screening-overview-panel";
import { DEMO_KPIS } from "@/lib/demo/dashboard-data";
import BrainViewer from "@/components/brain/BrainViewer";

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <BrainViewer />
      <ScreeningOverviewPanel />
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-5">
        {DEMO_KPIS.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>
    </div>
  );
}