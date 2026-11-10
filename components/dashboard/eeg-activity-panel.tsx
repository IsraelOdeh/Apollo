'use client';

import { useEffect, useState } from 'react';
import { Panel } from '@/components/layout/panel';
import { Sparkline } from '@/components/charts/sparkline';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { EEG_BAND_SYMBOL, generateBandSignal, rootMeanSquare, type EegBand } from '@/lib/eeg/synthetic-signal';

const BANDS: { id: EegBand; label: string; range: string; color: string }[] = [
  { id: 'delta', label: 'Delta', range: '0.5 to 4 Hz', color: '#42D9F5' },
  { id: 'theta', label: 'Theta', range: '4 to 8 Hz', color: '#9D85FF' },
  { id: 'alpha', label: 'Alpha', range: '8 to 13 Hz', color: '#36E0A1' },
  { id: 'beta', label: 'Beta', range: '13 to 30 Hz', color: '#F6BD60' },
  { id: 'gamma', label: 'Gamma', range: '30 to 45 Hz', color: '#F8A5C2' },
];

const POINTS = 200;
const FRAME_MS = 80;
const SHIFT_PER_FRAME = 0.02;

export function EegActivityPanel() {
  const [shift, setShift] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => setShift((value) => value + SHIFT_PER_FRAME), FRAME_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <Panel
      title="EEG Activity"
      eyebrow="Frequency bands"
      actions={<span className="font-mono text-[10px] text-ne-fg-3">Demo signal</span>}
    >
      <ul className="flex flex-col divide-y divide-ne-line">
        {BANDS.map((band, index) => {
          const values = generateBandSignal(band.id, { points: POINTS, shift, seed: index + 1 });
          const amplitude = rootMeanSquare(values);
          const activity = Math.min(100, amplitude * 120);
          return (
            <li key={band.id} className="grid grid-cols-[84px_1fr_78px] items-center gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ne-fg">
                  <span style={{ color: band.color }} className="font-mono text-sm">
                    {EEG_BAND_SYMBOL[band.id]}
                  </span>
                  {band.label}
                </p>
                <p className="truncate font-mono text-[10px] text-ne-fg-3">{band.range}</p>
              </div>

              <Sparkline values={values} color={band.color} className="h-9 w-full" />

              <div className="text-right">
                <p className="font-mono text-xs text-ne-fg">{(amplitude * 40).toFixed(1)} µV</p>
                <div className="ml-auto mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ne-bg2">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${activity}%`, backgroundColor: band.color }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
