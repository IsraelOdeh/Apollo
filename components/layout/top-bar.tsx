// components/layout/top-bar.tsx
"use client";

import Link from "next/link";
import {
  Bell,
  BookOpen,
  Cpu,
  Lock,
  Menu,
  Moon,
  Search,
  Settings as SettingsIcon,
  Stethoscope,
  Sun,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";
import { useThemeMode } from "./neuroedge-logo";
import { useWorkstationPolicy } from "@/lib/privacy/workstation-policy";

type TopBarProps = {
  item: NavItem;
  online: boolean;
  onOpenNavigation: () => void;
};

export function TopBar({ item, online, onOpenNavigation }: TopBarProps) {
  const { theme, setTheme } = useThemeMode();
  const { policy } = useWorkstationPolicy();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ne-line bg-ne-bg/85 px-4 backdrop-blur-xl md:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNavigation}
        aria-label="Open navigation"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ne-line text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg lg:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ne-fg-2">
          NeuroEdge / {item.label}
        </p>
        <h1 className="truncate text-base font-semibold text-ne-fg md:text-lg">
          {item.label}
        </h1>
      </div>

      {/* <label className="relative hidden w-64 xl:block">
        <span className="sr-only">Global search</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ne-fg-3"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search recordings, events, IDs"
          className="h-9 w-full rounded-lg border border-ne-line bg-ne-card pl-9 pr-3 text-sm text-ne-fg placeholder:text-ne-fg-3 focus:border-ne-cyan/50 focus:outline-none focus:ring-1 focus:ring-ne-cyan/30"
        />
      </label> */}

      {/* Privacy-by-default verification pill */}
      {policy.localOnlyMode && (
        <Link
          href="/settings"
          title="Local-only mode active: zero raw EEG data leaves this browser"
          className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-ne-cyan/30 bg-ne-cyan/10 px-3 font-mono text-[10px] font-semibold tracking-[0.12em] text-ne-cyan transition-colors hover:bg-ne-cyan/20 sm:flex"
        >
          <Lock className="h-3 w-3" aria-hidden="true" />
          <span>LOCAL-ONLY</span>
        </Link>
      )}

      <ConnectionPill online={online} />

      <button
        type="button"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-label="Toggle light and dark theme"
        title={
          theme === "light" ? "Switch to dark mode" : "Switch to light mode"
        }
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ne-line text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg"
      >
        {theme === "light" ? (
          <Moon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {/* <NotificationsMenu /> */}
      <UserMenu />
    </header>
  );
}

function ConnectionPill({ online }: { online: boolean }) {
  const Icon = online ? Wifi : WifiOff;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 font-mono text-[11px] font-semibold tracking-[0.14em]",
        online
          ? "border-ne-emerald/30 bg-ne-emerald/10 text-ne-emerald"
          : "border-ne-amber/40 bg-ne-amber/15 text-ne-amber",
      )}
    >
      <span className="relative flex h-2 w-2">
        {online && (
          <span className="ne-pulse absolute inset-0 rounded-full bg-ne-emerald" />
        )}
        <span
          className={cn(
            "relative h-2 w-2 rounded-full",
            online ? "bg-ne-emerald" : "bg-ne-amber",
          )}
        />
      </span>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{online ? "ONLINE" : "OFFLINE"}</span>
    </div>
  );
}

function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ne-line text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-ne-line bg-ne-elevated text-ne-fg"
      >
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.14em] text-ne-fg-2">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-ne-line" />
        <p className="px-2 py-3 text-sm text-ne-fg-2">No new alerts.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { policy, updatePolicy } = useWorkstationPolicy();
  const isEducation = policy.role === "education";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-ne-line bg-ne-card pl-1 pr-3 text-sm text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ne-elevated font-mono text-[11px] text-ne-fg">
            {isEducation ? "ED" : "CL"}
          </span>
          <span className="hidden md:inline">{policy.reviewerName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60 border-ne-line bg-ne-elevated text-ne-fg"
      >
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{policy.reviewerName}</p>
          <p className="text-xs font-normal text-ne-fg-3">
            {isEducation ? "Caregiver / Education view" : "Clinician review view"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-ne-line" />
        <DropdownMenuItem
          onClick={() =>
            updatePolicy({ role: isEducation ? "clinician" : "education" })
          }
          className="cursor-pointer focus:bg-ne-hover focus:text-ne-fg"
        >
          {isEducation ? (
            <>
              <Stethoscope className="mr-2 h-4 w-4 text-ne-emerald" />
              Switch to Clinician view
            </>
          ) : (
            <>
              <BookOpen className="mr-2 h-4 w-4 text-ne-cyan" />
              Switch to Education view
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="cursor-pointer focus:bg-ne-hover focus:text-ne-fg"
        >
          <Link href="/settings">
            <SettingsIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Settings &amp; Privacy
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="cursor-pointer focus:bg-ne-hover focus:text-ne-fg"
        >
          <Link href="/devices">
            <Cpu className="mr-2 h-4 w-4" aria-hidden="true" />
            Device Manager
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}