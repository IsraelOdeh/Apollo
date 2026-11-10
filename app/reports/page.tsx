import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function ReportsPage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/reports')}
      plannedItems={[
        'Screening session summaries',
        'Candidate event distribution',
        'Model performance metrics',
        'PDF and CSV export with annotation history',
      ]}
    />
  );
}
