import {
  Activity,
  AudioWaveform,
  Boxes,
  BrainCircuit,
  Cpu,
  Database,
  FileText,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const PRIMARY_NAV: NavItem[] = [
  {
    href: '/',
    label: 'Overview',
    description: 'Neural activity and screening status at a glance.',
    icon: LayoutDashboard,
  },
  {
    href: '/workspace',
    label: 'EEG Workspace',
    description: 'Multichannel EEG visualization and analysis.',
    icon: Activity,
  },
  {
    href: '/screening',
    label: 'AI Screening',
    description: 'AI-assisted candidate review for clinician validation.',
    icon: BrainCircuit,
  },
  {
    href: '/recordings',
    label: 'Recordings',
    description: 'Searchable library of imported EEG recordings.',
    icon: AudioWaveform,
  },
  {
    href: '/repository',
    label: 'Brain Data',
    description: 'Standardized local research records and synchronization.',
    icon: Database,
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'Screening session summaries and exports.',
    icon: FileText,
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    href: '/devices',
    label: 'Device Manager',
    description: 'EEG acquisition hardware connection and streaming.',
    icon: Cpu,
  },
  {
    href: '/model',
    label: 'Model Information',
    description: 'Screening model version, inputs and supported tasks.',
    icon: Boxes,
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Preferences, storage, signal processing and privacy.',
    icon: Settings,
  },
];

const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function findNavItem(pathname: string): NavItem {
  return ALL_NAV.find((item) => item.href === pathname) ?? ALL_NAV[0];
}
