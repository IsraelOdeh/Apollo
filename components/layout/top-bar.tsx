// components/layout/top-bar.tsx
"use client";

import Link from "next/link";
import {
  BookOpen,
  Cpu,
  Lock,
  Menu,
  Moon,
  Settings as SettingsIcon,
  Stethoscope,
  Sun,
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

export function TopBar({ item, onOpenNavigation }: TopBarProps) {
  const { theme, setTheme } = useThemeMode();
  const { policy, updatePolicy } = useWorkstationPolicy();
  const isEducation = policy.role === "education";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ne-line bg-ne-bg/85 px-4 backdrop-blur-xl md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ne-line text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <h1 className="truncate text-base font-semibold tracking-tight text-ne-fg">
          {item.label}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Compact Clinical / Education role toggle */}
        <div
          role="group"
          aria-label="Switch view mode"
          className="flex h-8 items-center rounded-lg border border-ne-line bg-ne-card p-0.5"
        >
          <button
            type="button"
            aria-pressed={!isEducation}
            onClick={() => updatePolicy({ role: "clinician" })}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              !isEducation
                ? "bg-ne-emerald/15 text-ne-emerald"
                : "text-ne-fg-3 hover:text-ne-fg",
            )}
          >
            <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Clinical</span>
          </button>
          <button
            type="button"
            aria-pressed={isEducation}
            onClick={() => updatePolicy({ role: "education" })}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              isEducation
                ? "bg-ne-cyan/15 text-ne-cyan"
                : "text-ne-fg-3 hover:text-ne-fg",
            )}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Education</span>
          </button>
        </div>

        {/* Light / Dark theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label="Toggle light and dark theme"
          title={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ne-line bg-ne-card text-ne-fg-2 transition-colors hover:bg-ne-hover hover:text-ne-fg"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Compact avatar dropdown */}
        <UserMenu />
      </div>
    </header>
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
          title={policy.reviewerName}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ne-line bg-ne-card font-mono text-[11px] font-semibold text-ne-fg transition-colors hover:border-ne-cyan/50 hover:bg-ne-hover"
        >
          {isEducation ? "ED" : "CL"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-ne-line bg-ne-elevated text-ne-fg"
      >
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{policy.reviewerName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-ne-fg-3">
            {policy.localOnlyMode && (
              <Lock className="h-3 w-3 text-ne-cyan" aria-hidden="true" />
            )}
            <span>
              {policy.localOnlyMode ? "Local-only · " : ""}
              {isEducation ? "Education view" : "Clinical view"}
            </span>
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
              Switch to Clinical view
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