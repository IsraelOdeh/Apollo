import type { CandidateEvent, EventReviewStatus, ReviewActionRecord } from '@/lib/db/types'
export type NewCandidateEvent = Omit<CandidateEvent, 'id' | 'created_at' | 'updated_at' | 'clinical_note' | 'review_status' | 'source'> & { source: 'model'; review_status: 'pending' }
const endpoint = '/api/neuroedge'
export async function fetchAllEvents(): Promise<CandidateEvent[]> { const response = await fetch(`${endpoint}?resource=events`); if (!response.ok) throw new Error('Could not load events'); return response.json() }
export async function fetchReviewActions(): Promise<ReviewActionRecord[]> { const response = await fetch(`${endpoint}?resource=review-actions`); if (!response.ok) throw new Error('Could not load review history'); return response.json() }
export async function insertCandidateEvents(events: NewCandidateEvent[]): Promise<void> { if (!events.length) return; const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'events', data: events }) }); if (!response.ok) throw new Error('Could not save screening events') }
type ReviewUpdate = { eventId: string; reviewStatus: EventReviewStatus; clinicalNote: string; action: ReviewActionRecord['action']; actionNote: string }
export async function applyEventReview(update: ReviewUpdate): Promise<void> { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'review', data: update }) }); if (!response.ok) throw new Error('Could not update event') }
