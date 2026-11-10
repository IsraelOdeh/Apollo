import { cn } from '@/lib/utils';

type ElectrodeLayoutEntry = [label: string, x: number, y: number];

const ELECTRODE_LAYOUT: ElectrodeLayoutEntry[] = [
  ['Fp1', -0.3, -0.9], ['Fp2', 0.3, -0.9],
  ['F7', -0.7, -0.5], ['F3', -0.35, -0.5], ['Fz', 0, -0.5], ['F4', 0.35, -0.5], ['F8', 0.7, -0.5],
  ['T3', -0.9, 0], ['C3', -0.45, 0], ['Cz', 0, 0], ['C4', 0.45, 0], ['T4', 0.9, 0],
  ['T5', -0.7, 0.5], ['P3', -0.35, 0.5], ['Pz', 0, 0.5], ['P4', 0.35, 0.5], ['T6', 0.7, 0.5],
  ['O1', -0.3, 0.9], ['O2', 0.3, 0.9],
];

const ELECTRODES = ELECTRODE_LAYOUT.map(([label, x, y]) => ({
  label,
  cx: 100 + x * 80,
  cy: 100 + y * 80,
}));

type ElectrodeMapProps = {
  selected: string | null;
  onSelect: (label: string) => void;
};

export function ElectrodeMap({ selected, onSelect }: ElectrodeMapProps) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" role="group" aria-label="10-20 electrode layout">
      <circle cx="100" cy="100" r="88" fill="rgba(66,217,245,0.03)" stroke="rgba(148,163,184,0.35)" strokeWidth="1.2" />
      <path d="M92 13 L100 3 L108 13" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="1.2" />
      <line x1="12" y1="100" x2="188" y2="100" stroke="rgba(148,163,184,0.12)" />
      <line x1="100" y1="12" x2="100" y2="188" stroke="rgba(148,163,184,0.12)" />

      {ELECTRODES.map((electrode) => {
        const isSelected = electrode.label === selected;
        return (
          <g
            key={electrode.label}
            role="button"
            tabIndex={0}
            aria-label={`Electrode ${electrode.label}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(electrode.label)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(electrode.label);
              }
            }}
            className="cursor-pointer outline-none"
          >
            <circle
              cx={electrode.cx}
              cy={electrode.cy}
              r={isSelected ? 7 : 5}
              fill={isSelected ? '#36E0A1' : 'rgba(240,244,248,0.18)'}
              stroke={isSelected ? '#36E0A1' : 'rgba(240,244,248,0.4)'}
              strokeWidth="1"
              className="transition-all duration-200"
            />
            <text
              x={electrode.cx}
              y={electrode.cy - 9}
              textAnchor="middle"
              fontSize="7"
              className={cn('pointer-events-none font-mono', isSelected ? 'fill-ne-emerald' : 'fill-ne-fg-2')}
            >
              {electrode.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
