import { NextResponse } from 'next/server'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { candidateEvents, recordings, reviewActions, workstationSettings } from '@/lib/db/schema'

export async function GET(request: Request) {
  const resource = new URL(request.url).searchParams.get('resource')
  if (resource === 'recordings') return NextResponse.json(await db.select().from(recordings).orderBy(desc(recordings.recordedAt)))
  if (resource === 'events') return NextResponse.json(await db.select().from(candidateEvents).orderBy(asc(candidateEvents.startSeconds)))
  if (resource === 'review-actions') return NextResponse.json(await db.select().from(reviewActions).orderBy(desc(reviewActions.createdAt)))
  if (resource === 'settings') {
    const rows = await db.select().from(workstationSettings).where(eq(workstationSettings.id, 'default'))
    return NextResponse.json(rows[0] ?? null)
  }
  return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
}

export async function POST(request: Request) {
  const body = await request.json()
  if (body.resource === 'recordings') {
    if (body.data.id) {
      const { id, ...patch } = body.data
      await db.update(recordings).set(patch).where(eq(recordings.id, id))
      return NextResponse.json({ ok: true })
    }
    const [row] = await db.insert(recordings).values(body.data).returning()
    return NextResponse.json(row)
  }
  if (body.resource === 'events') {
    await db.insert(candidateEvents).values(body.data)
    return NextResponse.json({ ok: true })
  }
  if (body.resource === 'review') {
    const [event] = await db.update(candidateEvents).set({ reviewStatus: body.data.reviewStatus, clinicalNote: body.data.clinicalNote, updatedAt: new Date() }).where(eq(candidateEvents.id, body.data.eventId)).returning()
    await db.insert(reviewActions).values({ eventId: body.data.eventId, action: body.data.action, note: body.data.actionNote, createdAt: new Date() })
    return NextResponse.json(event)
  }
  if (body.resource === 'settings') {
    await db.insert(workstationSettings).values({ id: 'default', settings: body.data, updatedAt: new Date() }).onConflictDoUpdate({ target: workstationSettings.id, set: { settings: body.data, updatedAt: new Date() } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
}
