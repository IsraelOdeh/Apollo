import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function DevicesPage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/devices')}
      plannedItems={[
        'Device connection card with channel count and sampling rate',
        'Live signal monitoring and packet rate',
        'Connect, disconnect, start and stop acquisition',
        'Clearly labeled demonstration streams',
      ]}
    />
  );
}
