import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function RepositoryPage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/repository')}
      plannedItems={[
        'Local record store with summary counts',
        'Standardized JSON and CSV export',
        'Offline synchronization queue',
        'Data validation indicators',
      ]}
    />
  );
}
