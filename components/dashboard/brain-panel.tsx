'use client';

import { useState } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';
import { Panel } from '@/components/layout/panel';
import { Sparkline } from '@/components/charts/sparkline';
import { generateBandSignal } from '@/lib/eeg/synthetic-signal';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';
import { Brain3D } from './brain/brain-3d';
import { BRAIN_REGIONS, type BrainRegionId } from './brain/brain-regions';
import { ElectrodeMap } from './brain/electrode-map';

type View = 'overview' | 'electrodes' | 'signals';

const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Brain Overview' },
  { id: 'electrodes', label: 'Electrode Map' },
  { id: 'signals', label: 'Signal Activity' },
];

const SIGNAL_CHANNELS = ['F3', 'C3', 'P3', 'O1'];

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;

export function BrainPanel() {
  const [view, setView] = useState<View>('overview');
  const [zoom, setZoom] = useState(1);
  const [hoveredRegion, setHoveredRegion] = useState<BrainRegionId | null>(null);
  const [selectedElectrode, setSelectedElectrode] = useState<string | null>('Cz');
  const reducedMotion = usePrefersReducedMotion();

  const regionLabel = BRAIN_REGIONS.find((region) => region.id === hoveredRegion)?.label;

  return (
    <Panel
      title="Neural Activity Overview"
      eyebrow="Demonstration stream"
      className="h-full"
      actions={<RecordingBadge />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />
          <div className="flex items-center gap-1">
            <IconButton
              label="Zoom in"
              disabled={zoom >= ZOOM_MAX || view === 'electrodes'}
              onClick={() => setZoom((value) => Math.min(ZOOM_MAX, +(value + ZOOM_STEP).toFixed(2)))}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Zoom out"
              disabled={zoom <= ZOOM_MIN || view === 'electrodes'}
              onClick={() => setZoom((value) => Math.max(ZOOM_MIN, +(value - ZOOM_STEP).toFixed(2)))}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <IconButton label="Reset view" onClick={() => setZoom(1)}>
              <Crosshair className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        <div className="relative aspect-[4/3] min-h-[280px] overflow-hidden rounded-xl border border-ne-line bg-[radial-gradient(ellipse_at_center,rgba(66,217,245,0.08),transparent_70%),#0D121A]">
          {view === 'electrodes' ? (
            <div className="h-full w-full p-4">
              <ElectrodeMap selected={selectedElectrode} onSelect={setSelectedElectrode} />
            </div>
          ) : (
            <Brain3D
              activeRegion={hoveredRegion}
              allRegionsActive={view === 'signals'}
              zoom={zoom}
              animate={!reducedMotion}
              onRegionHover={setHoveredRegion}
            />
          )}

          <div className="pointer-events-none absolute left-4 top-4 font-mono text-[11px] text-ne-fg-2">
            {view === 'electrodes'
              ? selectedElectrode
                ? `Channel ${selectedElectrode} selected`
                : 'Select an electrode'
              : regionLabel
                ? `Illustrative region: ${regionLabel}`
                : 'Drag to rotate, scroll to zoom'}
          </div>
        </div>

        {view === 'signals' && <SignalStrip />}

        <p className="text-xs leading-relaxed text-ne-fg-3">
          Illustrative localization for orientation only. Highlighted regions are not validated for clinical localization.
        </p>
      </div>
    </Panel>
  );
}

function RecordingBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-ne-critical/30 bg-ne-critical/10 px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-ne-critical">
      <span className="ne-pulse h-1.5 w-1.5 rounded-full bg-ne-critical" />
      DEMO STREAM
    </div>
  );
}

function SignalStrip() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {SIGNAL_CHANNELS.map((channel, index) => (
        <div key={channel} className="rounded-xl border border-ne-line bg-ne-bg2 p-3">
          <p className="font-mono text-[11px] text-ne-fg-2">{channel}</p>
          <Sparkline
            values={generateBandSignal('alpha', { points: 80, seed: index + 3 })}
            color="#42D9F5"
            className="mt-2 h-8 w-full"
          />
        </div>
      ))}
    </div>
  );
}

type SegmentedControlProps<T extends string> = {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-ne-line bg-ne-bg2 p-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200',
              active ? 'bg-ne-elevated text-ne-fg shadow-sm' : 'text-ne-fg-2 hover:text-ne-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type IconButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function IconButton({ label, disabled, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-ne-line bg-ne-bg2 text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
