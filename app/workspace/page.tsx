import { SectionPlaceholder } from '@/components/layout/section-placeholder';
import { findNavItem } from '@/components/layout/nav-items';

export default function WorkspacePage() {
  return (
    <SectionPlaceholder
      item={findNavItem('/workspace')}
      plannedItems={[
        'EDF and EDF+ recording import',
        'Stacked multichannel waveforms with zoom',
        'High-pass, low-pass, notch and gain controls',
        'Time-range selection and playback',
      ]}
    />
  );
}
