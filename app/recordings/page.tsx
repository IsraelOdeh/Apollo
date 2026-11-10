import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function RecordingsPage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/recordings')}
      plannedItems={[
        'Searchable and filterable recordings table',
        'Pseudonymous recording identifiers',
        'Sorting and pagination',
        'Open any recording in the EEG workspace',
      ]}
    />
  );
}
