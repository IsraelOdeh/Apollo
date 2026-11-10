import { supabase } from '@/lib/supabase/client';
import type { WorkstationSettings } from '@/lib/db/types';

const SETTINGS_ROW_ID = 'default';

export const DEFAULT_SETTINGS: WorkstationSettings = {
  filters: { highPassHz: 0.5, lowPassHz: 70, notchHz: 50 },
  candidateThreshold: 0.6,
  artifactThresholdMicrovolts: 150,
  autoSync: true,
  displayName: 'Research Operator',
  defaultWindowSeconds: 10,
  reducedMotion: false,
};

export async function fetchSettings(): Promise<WorkstationSettings> {
  const { data, error } = await supabase
    .from('workstation_settings')
    .select('settings')
    .eq('id', SETTINGS_ROW_ID)
    .maybeSingle<{ settings: Partial<WorkstationSettings> }>();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) };
}

export async function saveSettings(settings: WorkstationSettings): Promise<void> {
  const { error } = await supabase.from('workstation_settings').upsert(
    { id: SETTINGS_ROW_ID, settings, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`Could not save settings: ${error.message}`);
}
