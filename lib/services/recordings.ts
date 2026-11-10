import type { Recording } from '@/lib/db/types'
export type NewRecording = Omit<Recording, 'id' | 'created_at'>
const endpoint = '/api/neuroedge'
export async function fetchRecordings(): Promise<Recording[]> { const response = await fetch(`${endpoint}?resource=recordings`); if (!response.ok) throw new Error('Could not load recordings'); return response.json() }
export async function fetchRecordingByPseudonym(pseudonymId: string): Promise<Recording | null> { const rows = await fetchRecordings(); return rows.find((row) => row.pseudonym_id === pseudonymId) ?? null }
export async function insertRecording(recording: NewRecording): Promise<Recording> { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'recordings', data: recording }) }); if (!response.ok) throw new Error('Could not save recording'); return response.json() }
export async function updateRecording(id: string, patch: Partial<Pick<Recording, 'screening_status' | 'review_status' | 'model_version' | 'processing_config' | 'sync_status'>>): Promise<void> { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'recordings', data: { id, ...patch } }) }); if (!response.ok) throw new Error('Could not update recording') }
