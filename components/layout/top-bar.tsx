// components/layout/top-bar.tsx
"use client";

import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronDown,
  Cpu,
  Lock,
  Menu,
  Moon,
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

      <RoleAndAccountMenu />
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

function RoleAndAccountMenu() {
  const { policy, updatePolicy } = useWorkstationPolicy();
  const isEducation = policy.role === "education";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch view mode and account menu"
          className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-ne-line bg-ne-card pl-1 pr-2.5 text-sm text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ne-elevated font-mono text-[11px] font-medium text-ne-fg">
            {isEducation ? "ED" : "NE"}
          </span>
          <span className="hidden md:inline">
            {isEducation ? "Education View" : policy.reviewerName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-ne-fg-3" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-60 border-ne-line bg-ne-elevated text-ne-fg"
      >
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{policy.reviewerName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-ne-fg-3">
            {policy.localOnlyMode && (
              <Lock className="h-3 w-3 text-ne-cyan" aria-hidden="true" />
            )}
            <span>
              {policy.localOnlyMode ? "Local-only workstation" : "Workstation"}
            </span>
          </p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-ne-line" />

        <DropdownMenuLabel className="py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ne-fg-3">
          View Mode
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => updatePolicy({ role: "clinician" })}
          className="cursor-pointer justify-between focus:bg-ne-hover focus:text-ne-fg"
        >
          <span className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-ne-emerald" aria-hidden="true" />
            <span>Clinical / Research</span>
          </span>
          {!isEducation && (
            <Check className="h-3.5 w-3.5 text-ne-emerald" aria-hidden="true" />
          )}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => updatePolicy({ role: "education" })}
          className="cursor-pointer justify-between focus:bg-ne-hover focus:text-ne-fg"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-ne-cyan" aria-hidden="true" />
            <span>Education / Civilian</span>
          </span>
          {isEducation && (
            <Check className="h-3.5 w-3.5 text-ne-cyan" aria-hidden="true" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-ne-line" />

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