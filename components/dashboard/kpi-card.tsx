import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Sparkline } from '@/components/charts/sparkline';
import { cn } from '@/lib/utils';
import type { DemoKpi } from '@/lib/demo/dashboard-data';

const TREND_STYLE = {
  positive: { text: 'text-ne-emerald', Icon: ArrowUpRight },
  warning: { text: 'text-ne-amber', Icon: Minus },
  neutral: { text: 'text-ne-fg-2', Icon: ArrowDownRight },
} as const;

export function KpiCard({ kpi }: { kpi: DemoKpi }) {
  const Icon = kpi.icon;
  const trend = TREND_STYLE[kpi.tone];
  const TrendIcon = trend.Icon;

  return (
    <article className="group flex min-w-[220px] snap-start flex-col justify-between gap-4 rounded-2xl border border-ne-line bg-ne-card/90 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-ne-cyan/25 hover:bg-ne-elevated md:min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-ne-line bg-ne-bg2"
          style={{ color: kpi.color }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <p className="text-right text-xs leading-tight text-ne-fg-2">{kpi.label}</p>
      </div>

      <div>
        <p className="font-mono text-3xl font-semibold tracking-tight text-ne-fg">{kpi.value}</p>
        <p className={cn('mt-1 flex items-center gap-1 text-xs', trend.text)}>
          <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{kpi.trend}</span>
        </p>
      </div>

      <Sparkline values={kpi.sparkline} color={kpi.color} className="h-9 w-full opacity-90 transition-opacity group-hover:opacity-100" />
    </article>
  );
}
