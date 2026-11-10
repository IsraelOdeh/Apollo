import { jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const recordings = pgTable('recordings', {
  id: uuid('id').defaultRandom().primaryKey(),
  pseudonymId: text('pseudonym_id').notNull(),
  sourceKind: text('source_kind').notNull(),
  fileName: text('file_name'),
  fileSizeBytes: numeric('file_size_bytes'),
  channelLabels: text('channel_labels').array().notNull().default([]),
  channelCount: numeric('channel_count').notNull(),
  samplingHz: numeric('sampling_hz').notNull(),
  durationSeconds: numeric('duration_seconds').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  quality: text('quality').notNull(),
  screeningStatus: text('screening_status').notNull(),
  reviewStatus: text('review_status').notNull(),
  modelVersion: text('model_version'),
  processingConfig: jsonb('processing_config').notNull().default({}),
  syncStatus: text('sync_status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

export const candidateEvents = pgTable('candidate_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  recordingId: uuid('recording_id').notNull(),
  eventType: text('event_type').notNull(),
  startSeconds: numeric('start_seconds').notNull(),
  durationSeconds: numeric('duration_seconds').notNull(),
  channels: text('channels').array().notNull().default([]),
  confidence: numeric('confidence'),
  signalQuality: text('signal_quality').notNull(),
  source: text('source').notNull(),
  reviewStatus: text('review_status').notNull(),
  clinicalNote: text('clinical_note').notNull().default(''),
  modelVersion: text('model_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const reviewActions = pgTable('review_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull(),
  action: text('action').notNull(),
  note: text('note').notNull().default(''),
  actor: text('actor').notNull().default('operator'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

export const workstationSettings = pgTable('workstation_settings', {
  id: text('id').primaryKey(),
  settings: jsonb('settings').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})
