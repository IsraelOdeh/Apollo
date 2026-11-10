'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { findNavItem } from './nav-items';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const online = useOnlineStatus();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const currentItem = findNavItem(pathname);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        online={online}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
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
          'flex min-h-screen flex-col transition-[padding] duration-300 ease-out',
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[240px]',
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
              Offline mode. Recordings and screenings keep working on this device, and
              synchronization resumes automatically when the connection returns.
            </p>
          </div>
        )}

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
