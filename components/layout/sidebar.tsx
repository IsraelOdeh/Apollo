'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BrainCircuit,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_SYSTEM_STATUS } from '@/lib/demo/system-status';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from './nav-items';

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  online: boolean;
  onToggleCollapsed: () => void;
};

export function Sidebar({ collapsed, mobileOpen, online, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-ne-line bg-ne-bg2/95 backdrop-blur-xl transition-[transform,width] duration-300 ease-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
        collapsed ? 'lg:w-[72px]' : 'lg:w-[240px]',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-ne-line px-4', collapsed && 'lg:justify-center lg:px-0')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald shadow-[0_0_24px_-6px_rgba(54,224,161,0.6)]">
          <BrainCircuit className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
          <p className="text-sm font-semibold tracking-[0.2em] text-ne-fg">NEUROEDGE</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ne-fg-3">EEG Screening</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <NavGroup label="Workspace" items={PRIMARY_NAV} pathname={pathname} collapsed={collapsed} />
        <NavGroup label="System" items={SECONDARY_NAV} pathname={pathname} collapsed={collapsed} />
      </nav>

      <div className="shrink-0 space-y-2 border-t border-ne-line p-3">
        <StatusRow
          icon={Radio}
          label={DEMO_SYSTEM_STATUS.deviceConnected ? 'Device connected' : 'No device connected'}
          tone={DEMO_SYSTEM_STATUS.deviceConnected ? 'positive' : 'neutral'}
          collapsed={collapsed}
        />
        <StatusRow
          icon={online ? Wifi : WifiOff}
          label={online ? 'Online' : 'Offline, local mode'}
          tone={online ? 'positive' : 'warning'}
          collapsed={collapsed}
        />

        <div className={cn('flex items-center gap-3 rounded-xl px-2 py-2', collapsed && 'lg:justify-center lg:px-0')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ne-line bg-ne-elevated font-mono text-xs text-ne-fg-2">
            RO
          </div>
          <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
            <p className="truncate text-sm font-medium text-ne-fg">{DEMO_SYSTEM_STATUS.operatorName}</p>
            <p className="truncate text-xs text-ne-fg-3">{DEMO_SYSTEM_STATUS.workstationLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg lg:flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className={cn(collapsed && 'lg:hidden')}>Collapse sidebar</span>
        </button>
      </div>
    </aside>
  );
}

type NavGroupProps = {
  label: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
};

function NavGroup({ label, items, pathname, collapsed }: NavGroupProps) {
  return (
    <div className="space-y-1">
      <p className={cn('px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ne-fg-3', collapsed && 'lg:hidden')}>
        {label}
      </p>
      {items.map((item) => {
        const active = item.href === pathname;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200',
              active ? 'bg-ne-elevated text-ne-fg' : 'text-ne-fg-2 hover:bg-ne-hover hover:text-ne-fg',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ne-emerald" />}
            <Icon
              className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-ne-emerald' : 'group-hover:text-ne-cyan')}
              aria-hidden="true"
            />
            <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

type StatusRowProps = {
  icon: LucideIcon;
  label: string;
  tone: 'positive' | 'warning' | 'neutral';
  collapsed: boolean;
};

function StatusRow({ icon: Icon, label, tone, collapsed }: StatusRowProps) {
  const toneClass = {
    positive: 'text-ne-emerald',
    warning: 'text-ne-amber',
    neutral: 'text-ne-fg-3',
  }[tone];

  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-2 py-1.5', collapsed && 'lg:justify-center lg:px-0')}>
      <Icon className={cn('h-4 w-4 shrink-0', toneClass)} aria-hidden="true" />
      <span className={cn('truncate text-xs text-ne-fg-2', collapsed && 'lg:hidden')}>{label}</span>
    </div>
  );
}
