import { supabase } from '@/lib/supabase/client';
import type {
  CandidateEvent,
  EventReviewStatus,
  ReviewActionRecord,
} from '@/lib/db/types';

export type NewCandidateEvent = Omit<CandidateEvent, 'id' | 'created_at' | 'updated_at' | 'clinical_note' | 'review_status' | 'source'> & {
  source: 'model';
  review_status: 'pending';
};

export async function fetchAllEvents(): Promise<CandidateEvent[]> {
  const { data, error } = await supabase
    .from('candidate_events')
    .select('*')
    .order('start_seconds', { ascending: true })
    .returns<CandidateEvent[]>();
  if (error) throw new Error(`Could not load events: ${error.message}`);
  return data ?? [];
}

export async function fetchReviewActions(): Promise<ReviewActionRecord[]> {
  const { data, error } = await supabase
    .from('review_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<ReviewActionRecord[]>();
  if (error) throw new Error(`Could not load review history: ${error.message}`);
  return data ?? [];
}

export async function insertCandidateEvents(events: NewCandidateEvent[]): Promise<void> {
  if (events.length === 0) return;
  const { error } = await supabase.from('candidate_events').insert(events);
  if (error) throw new Error(`Could not save screening events: ${error.message}`);
}

type ReviewUpdate = {
  eventId: string;
  reviewStatus: EventReviewStatus;
  clinicalNote: string;
  action: ReviewActionRecord['action'];
  actionNote: string;
};

export async function applyEventReview(update: ReviewUpdate): Promise<void> {
  const { error: eventError } = await supabase
    .from('candidate_events')
    .update({
      review_status: update.reviewStatus,
      clinical_note: update.clinicalNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', update.eventId);
  if (eventError) throw new Error(`Could not update event: ${eventError.message}`);

  const { error: historyError } = await supabase.from('review_actions').insert({
    event_id: update.eventId,
    action: update.action,
    note: update.actionNote,
  });
  if (historyError) throw new Error(`Could not record review history: ${historyError.message}`);
}
