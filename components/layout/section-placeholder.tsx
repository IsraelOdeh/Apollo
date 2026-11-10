import type { NavItem } from './nav-items';
import { Panel } from './panel';

type SectionPlaceholderProps = {
  item: NavItem;
  plannedItems: string[];
};

export function SectionPlaceholder({ item, plannedItems }: SectionPlaceholderProps) {
  const Icon = item.icon;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Panel title={item.label} eyebrow="Next build stage">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-ne-line bg-ne-bg2 text-ne-emerald">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm leading-relaxed text-ne-fg-2">{item.description}</p>
        </div>

        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {plannedItems.map((planned) => (
            <li
              key={planned}
              className="flex items-start gap-3 rounded-xl border border-ne-line bg-ne-bg2 px-4 py-3 text-sm text-ne-fg-2"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ne-cyan" aria-hidden="true" />
              {planned}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
