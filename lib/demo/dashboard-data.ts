import {
  AudioWaveform,
  Cloud,
  ClipboardCheck,
  ScanSearch,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type KpiTone = 'positive' | 'warning' | 'neutral';

export type DemoKpi = {
  id: string;
  label: string;
  value: string;
  trend: string;
  tone: KpiTone;
  icon: LucideIcon;
  color: string;
  sparkline: number[];
};

export const DEMO_KPIS: DemoKpi[] = [
  {
    id: 'recordings',
    label: 'EEG Recordings',
    value: '1,284',
    trend: '+36 this week',
    tone: 'positive',
    icon: AudioWaveform,
    color: '#42D9F5',
    sparkline: [18, 22, 21, 27, 31, 30, 36, 41],
  },
  {
    id: 'screenings',
    label: 'Screenings Completed',
    value: '1,117',
    trend: '87% of recordings',
    tone: 'neutral',
    icon: ScanSearch,
    color: '#36E0A1',
    sparkline: [12, 15, 19, 18, 24, 26, 29, 33],
  },
  {
    id: 'candidates',
    label: 'Candidate IED Events',
    value: '86',
    trend: 'Awaiting clinician review',
    tone: 'warning',
    icon: Zap,
    color: '#F6BD60',
    sparkline: [4, 6, 3, 8, 7, 11, 9, 12],
  },
  {
    id: 'review',
    label: 'Recordings Requiring Review',
    value: '41',
    trend: '6 flagged as low quality',
    tone: 'warning',
    icon: ClipboardCheck,
    color: '#9D85FF',
    sparkline: [9, 7, 11, 8, 12, 10, 13, 11],
  },
  {
    id: 'sync',
    label: 'Data Synchronization',
    value: '96.4%',
    trend: '7 queued offline',
    tone: 'neutral',
    icon: Cloud,
    color: '#36E0A1',
    sparkline: [88, 91, 90, 93, 95, 94, 96, 96],
  },
];

export const DEMO_SCREENING_WEEK = [
  { day: 'Mon', screenings: 14, candidates: 2, awaitingReview: 6 },
  { day: 'Tue', screenings: 18, candidates: 3, awaitingReview: 5 },
  { day: 'Wed', screenings: 12, candidates: 1, awaitingReview: 4 },
  { day: 'Thu', screenings: 21, candidates: 4, awaitingReview: 8 },
  { day: 'Fri', screenings: 17, candidates: 3, awaitingReview: 7 },
  { day: 'Sat', screenings: 9, candidates: 1, awaitingReview: 3 },
  { day: 'Sun', screenings: 6, candidates: 0, awaitingReview: 2 },
];
