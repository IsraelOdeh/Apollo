import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/settings')}
      plannedItems={[
        'General preferences and appearance',
        'Offline storage management',
        'Signal-processing defaults',
        'Privacy and security controls',
      ]}
    />
  );
}
