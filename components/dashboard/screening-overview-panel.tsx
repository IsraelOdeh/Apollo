'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel } from '@/components/layout/panel';
import { DEMO_SCREENING_WEEK } from '@/lib/demo/dashboard-data';

const SERIES = [
  { key: 'screenings', label: 'Screenings', color: '#42D9F5' },
  { key: 'candidates', label: 'Candidate events', color: '#F6BD60' },
  { key: 'awaitingReview', label: 'Awaiting review', color: '#9D85FF' },
] as const;

const TOTALS = [
  { label: 'Total recordings', value: '1,284' },
  { label: 'Screenings performed', value: '1,117' },
  { label: 'Candidate events flagged', value: '86' },
  { label: 'Awaiting review', value: '41' },
];

export function ScreeningOverviewPanel() {
  return (
    <Panel title="Screening Overview" eyebrow="Last 7 days, demonstration data">
      <div className="grid grid-cols-2 gap-3">
        {TOTALS.map((total) => (
          <div key={total.label} className="rounded-xl border border-ne-line bg-ne-bg2 px-3 py-2.5">
            <p className="font-mono text-lg font-semibold text-ne-fg">{total.value}</p>
            <p className="text-[11px] leading-tight text-ne-fg-2">{total.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DEMO_SCREENING_WEEK} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              {SERIES.map((series) => (
                <linearGradient key={series.key} id={`ne-area-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={series.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#A1ADBC', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#17212D', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#F0F4F8' }}
              itemStyle={{ color: '#A1ADBC' }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#A1ADBC' }} />
            {SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={1.8}
                fill={`url(#ne-area-${series.key})`}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
