import type { WorkstationSettings } from '@/lib/db/types'
const SETTINGS_ROW_ID = 'default'
export const DEFAULT_SETTINGS: WorkstationSettings = { filters: { highPassHz: 0.5, lowPassHz: 70, notchHz: 50 }, candidateThreshold: 0.6, artifactThresholdMicrovolts: 150, autoSync: true, displayName: 'Research Operator', defaultWindowSeconds: 10, reducedMotion: false }
export async function fetchSettings(): Promise<WorkstationSettings> { const response = await fetch('/api/neuroedge?resource=settings'); if (!response.ok) throw new Error('Could not load settings'); const data = await response.json(); return { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) } }
export async function saveSettings(settings: WorkstationSettings): Promise<void> { const response = await fetch('/api/neuroedge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'settings', data: settings }) }); if (!response.ok) throw new Error('Could not save settings') }
