import { supabase } from '@/lib/supabase/client';
import type { Recording } from '@/lib/db/types';

export type NewRecording = Omit<Recording, 'id' | 'created_at'>;

export async function fetchRecordings(): Promise<Recording[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .order('recorded_at', { ascending: false })
    .returns<Recording[]>();
  if (error) throw new Error(`Could not load recordings: ${error.message}`);
  return data ?? [];
}

export async function fetchRecordingByPseudonym(pseudonymId: string): Promise<Recording | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('pseudonym_id', pseudonymId)
    .maybeSingle<Recording>();
  if (error) throw new Error(`Could not load recording ${pseudonymId}: ${error.message}`);
  return data;
}

export async function insertRecording(recording: NewRecording): Promise<Recording> {
  const { data, error } = await supabase
    .from('recordings')
    .insert(recording)
    .select('*')
    .returns<Recording[]>();
  if (error || !data || data.length === 0) {
    throw new Error(`Could not save recording: ${error?.message ?? 'no row returned'}`);
  }
  return data[0];
}

export async function updateRecording(
  id: string,
  patch: Partial<Pick<Recording, 'screening_status' | 'review_status' | 'model_version' | 'processing_config' | 'sync_status'>>,
): Promise<void> {
  const { error } = await supabase.from('recordings').update(patch).eq('id', id);
  if (error) throw new Error(`Could not update recording: ${error.message}`);
}
