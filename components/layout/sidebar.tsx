// components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_SYSTEM_STATUS } from "@/lib/demo/system-status";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-items";
import { NeuroEdgeWordmark } from "./neuroedge-logo";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  online: boolean;
  onToggleCollapsed: () => void;
};

export function Sidebar({
  collapsed,
  mobileOpen,
  online,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary navigation"
      style={{ width: collapsed ? 76 : 240 }}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-ne-line bg-ne-bg2/95 backdrop-blur-xl transition-[transform,width] duration-300 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}
    >
      {/* Top Header with Logo + Quick Collapse Toggle */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center border-b border-ne-line",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        <Link
          href="/"
          className="focus:outline-none"
          title="NeuroEdge Overview"
        >
          <NeuroEdgeWordmark collapsed={collapsed} />
        </Link>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border border-ne-line bg-ne-card text-ne-fg-2 shadow-sm transition-colors hover:border-ne-cyan hover:text-ne-fg",
            collapsed && "absolute -right-3.5 top-5 z-50 rounded-full"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Navigation Links (scrollbar hidden so no gray strip appears) */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavGroup
          label="Workspace"
          items={PRIMARY_NAV}
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavGroup
          label="System"
          items={SECONDARY_NAV}
          pathname={pathname}
          collapsed={collapsed}
        />
      </nav>

      {/* Footer Status & Collapse Button */}
      <div className="shrink-0 space-y-2 border-t border-ne-line p-3">
        <StatusRow
          icon={Radio}
          label={
            DEMO_SYSTEM_STATUS.deviceConnected
              ? "Hardware connected"
              : "Local EDF mode"
          }
          tone={DEMO_SYSTEM_STATUS.deviceConnected ? "positive" : "neutral"}
          collapsed={collapsed}
        />
        <StatusRow
          icon={online ? Wifi : WifiOff}
          label={online ? "Online" : "Offline mode"}
          tone={online ? "positive" : "warning"}
          collapsed={collapsed}
        />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {!collapsed && <span className="truncate">Collapse sidebar</span>}
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
      {!collapsed && (
        <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ne-fg-3">
          {label}
        </p>
      )}
      {items.map((item) => {
        const active = item.href === pathname;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200",
              active
                ? "bg-ne-elevated text-ne-fg"
                : "text-ne-fg-2 hover:bg-ne-hover hover:text-ne-fg",
              collapsed && "justify-center px-0"
            )}
          >
            {active && (
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ne-emerald" />
            )}
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-ne-emerald" : "group-hover:text-ne-cyan"
              )}
              aria-hidden="true"
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

type StatusRowProps = {
  icon: LucideIcon;
  label: string;
  tone: "positive" | "warning" | "neutral";
  collapsed: boolean;
};

function StatusRow({ icon: Icon, label, tone, collapsed }: StatusRowProps) {
  const toneClass = {
    positive: "text-ne-emerald",
    warning: "text-ne-amber",
    neutral: "text-ne-fg-3",
  }[tone];
  return (
    <div
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-2 py-1.5",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", toneClass)} aria-hidden="true" />
      {!collapsed && (
        <span className="truncate text-xs text-ne-fg-2">{label}</span>
      )}
    </div>
  );
}