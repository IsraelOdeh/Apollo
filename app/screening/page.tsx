import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function ScreeningPage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/screening')}
      plannedItems={[
        'Model status and processing progress',
        'Interactive candidate event timeline',
        'Mark, confirm, reject and annotate events',
        'Model output kept separate from clinician review',
      ]}
    />
  );
}
