import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function ModelPage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/model')}
      plannedItems={[
        'Model name, version and size',
        'Supported classification tasks',
        'Input sampling frequency',
        'Date of last update',
      ]}
    />
  );
}
