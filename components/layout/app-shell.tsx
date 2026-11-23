// components/layout/app-shell.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Lock, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useWorkstationPolicy } from "@/lib/privacy/workstation-policy";
import { findNavItem } from "./nav-items";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

const SIDEBAR_STORAGE_KEY = "ne_sidebar_collapsed";

// Routes that expose raw EDF waveforms, triage candidates, or clinical exports
const CLINICIAN_ONLY_ROUTES = [
  "/workspace",
  "/recordings",
  "/repository",
  "/reports",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const online = useOnlineStatus();
  const { policy, updatePolicy } = useWorkstationPolicy();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleToggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  const currentItem = findNavItem(pathname);
  const isRouteRestricted =
    policy.role === "education" && CLINICIAN_ONLY_ROUTES.includes(pathname);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        online={online}
        onToggleCollapsed={handleToggleCollapsed}
      />
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]",
        )}
      >
        <TopBar
          item={currentItem}
          online={online}
          onOpenNavigation={() => setMobileOpen(true)}
        />
        {!online && (
          <div
            role="status"
            className="flex items-center gap-3 border-b border-ne-amber/20 bg-ne-amber/10 px-4 py-2.5 text-sm text-ne-amber md:px-6 lg:px-8"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-ne-amber" />
            <p>
              Offline mode active. Recordings and screenings run locally on this
              workstation.
            </p>
          </div>
        )}
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          {isRouteRestricted ? (
            <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-ne-line bg-ne-card p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ne-cyan/30 bg-ne-cyan/10 text-ne-cyan">
                  <Lock className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ne-cyan">
                    Role-scoped output protection
                  </p>
                  <h2 className="text-base font-semibold text-ne-fg">
                    {currentItem.label} is restricted to Clinical view
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-ne-fg-2">
                Raw EEG waveforms, unreviewed seizure candidates, and session
                export tables are hidden while Education view is active so
                caregivers and learners only see plain-language cortical guides.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-lg border border-ne-line bg-ne-bg2 px-3.5 py-2 text-xs font-medium text-ne-fg hover:border-ne-cyan"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Return to 3D Brain Overview
                </Link>
                <button
                  type="button"
                  onClick={() => updatePolicy({ role: "clinician" })}
                  className="inline-flex items-center gap-2 rounded-lg border border-ne-emerald/30 bg-ne-emerald/10 px-3.5 py-2 text-xs font-medium text-ne-emerald hover:bg-ne-emerald/20"
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Switch to Clinical view
                </button>
              </div>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}