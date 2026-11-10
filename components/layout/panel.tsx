import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PanelProps = {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function Panel({ title, eyebrow, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-ne-line bg-ne-card/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-ne-line px-5 py-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ne-fg-2">{eyebrow}</p>
          )}
          <h2 className="truncate text-sm font-semibold tracking-wide text-ne-fg">{title}</h2>
        </div>
        {actions}
      </header>
      <div className={cn('flex-1 p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
