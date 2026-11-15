// components/layout/app-shell.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { findNavItem } from "./nav-items";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

const SIDEBAR_STORAGE_KEY = "ne_sidebar_collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const online = useOnlineStatus();
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
          collapsed ? "lg:pl-[76px]" : "lg:pl-[240px]"
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
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}