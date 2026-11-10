/*
# Create NeuroEdge core schema

Plain-English summary
NeuroEdge stores EEG recording metadata, AI screening candidate events, the clinician review history for those events, and workstation preferences. No raw EEG signal samples and no patient names are stored. Recordings are identified only by pseudonymous identifiers.

1. New Tables
- `recordings`: one row per EEG recording (pseudonymous ID, date, duration, channels, sampling frequency, quality, screening and review status, sync status, processing configuration).
- `candidate_events`: events produced by the screening workflow or added by a reviewer (IED candidates, artifacts, review segments). Stores time window, channels, model confidence, signal quality, review status and clinical note.
- `review_actions`: append-only history of review decisions on candidate events (annotation history).
- `workstation_settings`: one row of workstation preferences (filters, thresholds, sync options).

2. Security
- Row Level Security is enabled on every table.
- This app has no sign-in screen, so the anon and authenticated roles are granted the verbs the app uses, with policies that allow them.
- No DELETE is granted on any table. Recordings, events and review history are preserved for data integrity.
- `review_actions` is insert-only, so the annotation history cannot be rewritten.

3. Notes
- Foreign keys cascade from recordings to events only.
- Indexes support lookups by recording, event and review timestamp.
*/

CREATE TABLE IF NOT EXISTS recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id text NOT NULL UNIQUE,
  source_kind text NOT NULL CHECK (source_kind IN ('demo', 'imported')),
  file_name text,
  file_size_bytes bigint,
  channel_labels text[] NOT NULL DEFAULT '{}',
  channel_count integer NOT NULL CHECK (channel_count > 0),
  sampling_hz numeric NOT NULL CHECK (sampling_hz > 0),
  duration_seconds numeric NOT NULL CHECK (duration_seconds > 0),
  recorded_at timestamptz NOT NULL,
  quality text NOT NULL CHECK (quality IN ('good', 'fair', 'poor')),
  screening_status text NOT NULL DEFAULT 'not_screened' CHECK (screening_status IN ('not_screened', 'processing', 'screened', 'failed')),
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'in_review', 'reviewed')),
  model_version text,
  processing_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recordings_recorded_at_idx ON recordings (recorded_at);
CREATE INDEX IF NOT EXISTS recordings_screening_status_idx ON recordings (screening_status);

CREATE TABLE IF NOT EXISTS candidate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('ied_candidate', 'artifact', 'review_segment')),
  start_seconds numeric NOT NULL CHECK (start_seconds >= 0),
  duration_seconds numeric NOT NULL CHECK (duration_seconds > 0),
  channels text[] NOT NULL DEFAULT '{}',
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  signal_quality text NOT NULL CHECK (signal_quality IN ('good', 'fair', 'poor')),
  source text NOT NULL CHECK (source IN ('model', 'human')),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'marked', 'confirmed', 'rejected')),
  clinical_note text NOT NULL DEFAULT '',
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_events_recording_idx ON candidate_events (recording_id, start_seconds);

CREATE TABLE IF NOT EXISTS review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES candidate_events (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('marked', 'confirmed', 'rejected', 'note_added')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_actions_event_idx ON review_actions (event_id, created_at);

CREATE TABLE IF NOT EXISTS workstation_settings (
  id text PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstation_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON recordings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON candidate_events TO anon, authenticated;
GRANT SELECT, INSERT ON review_actions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON workstation_settings TO anon, authenticated;

DROP POLICY IF EXISTS "recordings_select" ON recordings;
CREATE POLICY "recordings_select" ON recordings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "recordings_insert" ON recordings;
CREATE POLICY "recordings_insert" ON recordings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "recordings_update" ON recordings;
CREATE POLICY "recordings_update" ON recordings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "candidate_events_select" ON candidate_events;
CREATE POLICY "candidate_events_select" ON candidate_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "candidate_events_insert" ON candidate_events;
CREATE POLICY "candidate_events_insert" ON candidate_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "candidate_events_update" ON candidate_events;
CREATE POLICY "candidate_events_update" ON candidate_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "review_actions_select" ON review_actions;
CREATE POLICY "review_actions_select" ON review_actions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "review_actions_insert" ON review_actions;
CREATE POLICY "review_actions_insert" ON review_actions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "workstation_settings_select" ON workstation_settings;
CREATE POLICY "workstation_settings_select" ON workstation_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workstation_settings_insert" ON workstation_settings;
CREATE POLICY "workstation_settings_insert" ON workstation_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workstation_settings_update" ON workstation_settings;
CREATE POLICY "workstation_settings_update" ON workstation_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
