import type { Vec3 } from './brain-geometry';

export type ViewMode = 'overview' | 'electrodes' | 'activity';
export type RecordingStatus = 'recording' | 'paused' | 'standby';

/** 0 = purple, 1 = cyan, 2 = emerald */
export type Hue = 0 | 1 | 2;
export const HUE_HEX = ['#9b6bff', '#2fe0ff', '#2cf0a8'] as const;

export type RegionKey =
  | 'frontal'
  | 'central'
  | 'parietal'
  | 'temporal'
  | 'occipital'
  | 'cerebellum';

export interface RegionDef {
  key: RegionKey;
  label: string;
  summary: string;
  hue: Hue;
  /** Anchor directions for the LEFT hemisphere (+x). Mirrored for the right. */
  rays: Vec3[];
  radius: number;
  surface: 'cerebrum' | 'cerebellum';
}

export const REGIONS: RegionDef[] = [
  {
    key: 'frontal',
    label: 'Frontal lobe',
    summary: 'Planning, decision-making, voluntary movement and speech production.',
    hue: 0,
    rays: [[0.35, 0.45, 0.85], [0.6, 0.15, 0.75], [0.2, 0.75, 0.55]],
    radius: 0.34,
    surface: 'cerebrum',
  },
  {
    key: 'central',
    label: 'Sensorimotor strip',
    summary: 'Primary motor and somatosensory cortex on either side of the central sulcus.',
    hue: 0,
    rays: [[0.25, 0.95, -0.02], [0.55, 0.75, 0.05], [0.8, 0.5, 0.1]],
    radius: 0.26,
    surface: 'cerebrum',
  },
  {
    key: 'parietal',
    label: 'Parietal lobe',
    summary: 'Spatial processing and integration of touch and body position.',
    hue: 1,
    rays: [[0.3, 0.7, -0.6], [0.6, 0.5, -0.65], [0.8, 0.2, -0.6]],
    radius: 0.32,
    surface: 'cerebrum',
  },
  {
    key: 'temporal',
    label: 'Temporal lobe',
    summary: 'Hearing, language comprehension and memory.',
    hue: 1,
    rays: [[0.95, -0.35, 0.3], [0.95, -0.35, -0.15], [0.85, -0.3, -0.5]],
    radius: 0.3,
    surface: 'cerebrum',
  },
  {
    key: 'occipital',
    label: 'Occipital lobe',
    summary: 'Primary visual processing.',
    hue: 2,
    rays: [[0.25, 0.2, -0.95], [0.45, -0.1, -0.9]],
    radius: 0.32,
    surface: 'cerebrum',
  },
  {
    key: 'cerebellum',
    label: 'Cerebellum',
    summary: 'Coordination, balance and motor learning.',
    hue: 2,
    rays: [[0.45, 0.35, -0.8], [0.4, -0.5, -0.7]],
    radius: 0.34,
    surface: 'cerebellum',
  },
];

export const regionByKey = (key: RegionKey) => REGIONS.find((r) => r.key === key)!;

/* ------------------------------------------------------------------ */
/* Electrodes                                                          */
/* ------------------------------------------------------------------ */

/**
 * Where a channel sits on the brain, and how much that claim can be trusted.
 *
 * - `illustrative`: derived from a standard electrode layout on a template
 *   brain. Good for orientation, not for clinical decisions.
 * - `validated`: supplied by the caller from subject-specific work (for
 *   example co-registered imaging). The viewer shows the label and provenance
 *   but still cannot draw it on the template surface with clinical accuracy.
 */
export interface Localization {
  status: 'illustrative' | 'validated';
  regionLabel: string;
  /** e.g. "Post-implant CT co-registered to pre-op MRI" */
  method?: string;
  /** e.g. a report id or reviewer, shown for traceability */
  reference?: string;
}

export interface Electrode {
  id: string;
  label: string;
  /** Direction from head centre, +x = subject's left, +y up, +z anterior */
  dir: Vec3;
  hemisphere: 'left' | 'right' | 'midline';
  region: RegionKey;
  /** Nominal underlying area for this scalp position on a template head */
  regionLabel: string;
  /** Optional validated localization supplied by the caller */
  localization?: Localization;
}

const e = (
  id: string,
  dir: Vec3,
  hemisphere: Electrode['hemisphere'],
  region: RegionKey,
  regionLabel: string,
): Electrode => ({ id, label: id, dir, hemisphere, region, regionLabel });

/** Standard 10-20 layout (19 channels) with approximate nominal regions. */
export const STANDARD_1020: Electrode[] = [
  e('Fp1', [0.294, 0.309, 0.904], 'left', 'frontal', 'Frontal pole (prefrontal)'),
  e('Fp2', [-0.294, 0.309, 0.904], 'right', 'frontal', 'Frontal pole (prefrontal)'),
  e('F7', [0.769, 0.309, 0.559], 'left', 'frontal', 'Inferior frontal'),
  e('F3', [0.478, 0.669, 0.57], 'left', 'frontal', 'Dorsolateral prefrontal'),
  e('Fz', [0, 0.809, 0.588], 'midline', 'frontal', 'Superior frontal (medial)'),
  e('F4', [-0.478, 0.669, 0.57], 'right', 'frontal', 'Dorsolateral prefrontal'),
  e('F8', [-0.769, 0.309, 0.559], 'right', 'frontal', 'Inferior frontal'),
  e('T7', [0.951, 0.309, 0], 'left', 'temporal', 'Mid-temporal'),
  e('C3', [0.588, 0.809, 0], 'left', 'central', 'Sensorimotor cortex'),
  e('Cz', [0, 1, 0], 'midline', 'central', 'Vertex (medial sensorimotor)'),
  e('C4', [-0.588, 0.809, 0], 'right', 'central', 'Sensorimotor cortex'),
  e('T8', [-0.951, 0.309, 0], 'right', 'temporal', 'Mid-temporal'),
  e('P7', [0.769, 0.309, -0.559], 'left', 'temporal', 'Posterior temporal'),
  e('P3', [0.478, 0.669, -0.57], 'left', 'parietal', 'Inferior parietal'),
  e('Pz', [0, 0.809, -0.588], 'midline', 'parietal', 'Superior parietal (medial)'),
  e('P4', [-0.478, 0.669, -0.57], 'right', 'parietal', 'Inferior parietal'),
  e('P8', [-0.769, 0.309, -0.559], 'right', 'temporal', 'Posterior temporal'),
  e('O1', [0.294, 0.309, -0.904], 'left', 'occipital', 'Occipital (visual)'),
  e('O2', [-0.294, 0.309, -0.904], 'right', 'occipital', 'Occipital (visual)'),
];

/* ------------------------------------------------------------------ */
/* Events and selection                                                */
/* ------------------------------------------------------------------ */

export type EventKind = 'spike' | 'burst' | 'slow-wave';

export const EVENT_LABEL: Record<EventKind, string> = {
  spike: 'Spike',
  burst: 'Rhythmic burst',
  'slow-wave': 'Slow wave',
};

export interface DetectedEvent {
  id: string;
  /** seconds since recording start */
  t: number;
  /** electrode id this event was detected on */
  channel: string;
  kind: EventKind;
  amplitudeUv: number;
}

export type Selection =
  | { kind: 'electrode'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'region'; key: RegionKey }
  | null;

export const regionHue = (key: RegionKey): Hue => regionByKey(key).hue;
