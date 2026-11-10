/*
# Seed demonstration recordings and screening events

Plain-English summary
Adds clearly labeled demonstration data so the library, screening timeline, repository and reports have realistic content on first open. Every row has source_kind = 'demo' or is a demonstration event on a demo recording. These are not patient records and no real screening result is implied. The model_version is marked as a demonstration model.

1. Data Added
- 16 demonstration recordings with pseudonymous identifiers (NE-DEMO-01 to NE-DEMO-16).
- Candidate events and artifacts for screened demonstration recordings, generated deterministically.
- Review history entries for demonstration events that already have a review decision.
- One default workstation settings row.

2. Safety
- The migration only inserts when no demonstration recordings exist, so re-running it does not duplicate rows.
- Recording references use stable pseudonymous identifiers, not copied database ids.

3. Notes
- No rows are modified or deleted.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM recordings WHERE source_kind = 'demo') THEN
    INSERT INTO recordings (pseudonym_id, source_kind, channel_labels, channel_count, sampling_hz, duration_seconds, recorded_at, quality, screening_status, review_status, model_version, sync_status, processing_config) VALUES
      ('NE-DEMO-01', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 1820, '2026-11-09 08:14:00+00', 'good', 'screened', 'reviewed', 'ied-screen-demo-0.1', 'synced', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-02', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 2400, '2026-11-09 10:42:00+00', 'fair', 'screened', 'in_review', 'ied-screen-demo-0.1', 'pending', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-03', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 1500, '2026-11-09 13:05:00+00', 'good', 'screened', 'unreviewed', 'ied-screen-demo-0.1', 'pending', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-04', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 3000, '2026-11-08 07:30:00+00', 'poor', 'screened', 'unreviewed', 'ied-screen-demo-0.1', 'pending', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-05', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 1980, '2026-11-08 11:20:00+00', 'good', 'screened', 'reviewed', 'ied-screen-demo-0.1', 'synced', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-06', 'demo', ARRAY['F3','F4','C3','C4','P3','P4','O1','O2'], 8, 256, 1200, '2026-11-08 15:45:00+00', 'good', 'screened', 'unreviewed', 'ied-screen-demo-0.1', 'pending', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":60}'),
      ('NE-DEMO-07', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 2700, '2026-11-07 09:00:00+00', 'fair', 'screened', 'in_review', 'ied-screen-demo-0.1', 'synced', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-08', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 1650, '2026-11-07 12:30:00+00', 'good', 'screened', 'reviewed', 'ied-screen-demo-0.1', 'synced', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-09', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 2100, '2026-11-06 16:10:00+00', 'good', 'not_screened', 'unreviewed', NULL, 'local', '{}'),
      ('NE-DEMO-10', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 1400, '2026-11-06 08:50:00+00', 'fair', 'screened', 'unreviewed', 'ied-screen-demo-0.1', 'failed', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-11', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 2250, '2026-11-05 14:00:00+00', 'good', 'screened', 'reviewed', 'ied-screen-demo-0.1', 'synced', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-12', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 1900, '2026-11-05 10:25:00+00', 'poor', 'failed', 'unreviewed', NULL, 'local', '{}'),
      ('NE-DEMO-13', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 2600, '2026-11-04 09:40:00+00', 'good', 'screened', 'in_review', 'ied-screen-demo-0.1', 'pending', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}'),
      ('NE-DEMO-14', 'demo', ARRAY['F3','F4','C3','C4','P3','P4','O1','O2'], 8, 256, 1100, '2026-11-04 17:15:00+00', 'good', 'screened', 'unreviewed', 'ied-screen-demo-0.1', 'pending', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":60}'),
      ('NE-DEMO-15', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 2950, '2026-11-03 08:05:00+00', 'fair', 'not_screened', 'unreviewed', NULL, 'local', '{}'),
      ('NE-DEMO-16', 'demo', ARRAY['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','F7','F8','T3','T4','T5','T6','Fz','Cz','Pz'], 19, 256, 1750, '2026-11-02 13:30:00+00', 'good', 'screened', 'reviewed', 'ied-screen-demo-0.1', 'synced', '{"highPassHz":0.5,"lowPassHz":70,"notchHz":50}');

    INSERT INTO candidate_events (recording_id, event_type, start_seconds, duration_seconds, channels, confidence, signal_quality, source, review_status, model_version)
    SELECT
      r.id,
      CASE WHEN g % 4 = 1 THEN 'artifact' ELSE 'ied_candidate' END,
      (60 + (g * 97 + abs(hashtext(r.pseudonym_id)) % 400))::numeric,
      (0.4 + (g % 3) * 0.3)::numeric,
      CASE WHEN g % 4 = 1 THEN ARRAY['Fp1','Fp2'] ELSE ARRAY[(ARRAY['F3','C3','T5','P3','O1','T3','F7','T4'])[1 + (g + abs(hashtext(r.pseudonym_id))) % 8]] END,
      CASE WHEN g % 4 = 1 THEN NULL ELSE (0.55 + ((g * 7 + abs(hashtext(r.pseudonym_id))) % 40) / 100.0)::numeric END,
      r.quality,
      'model',
      CASE
        WHEN g % 4 = 1 THEN 'pending'
        WHEN g % 5 = 0 THEN 'confirmed'
        WHEN g % 4 = 2 THEN 'rejected'
        ELSE 'pending'
      END,
      r.model_version
    FROM recordings r
    CROSS JOIN LATERAL generate_series(1, 2 + abs(hashtext(r.pseudonym_id)) % 5) AS g
    WHERE r.source_kind = 'demo' AND r.screening_status = 'screened';

    INSERT INTO review_actions (event_id, action, note)
    SELECT e.id,
      CASE e.review_status WHEN 'confirmed' THEN 'confirmed' ELSE 'rejected' END,
      CASE e.review_status WHEN 'confirmed' THEN 'Demonstration review: consistent with candidate morphology.' ELSE 'Demonstration review: artifact-like waveform.' END
    FROM candidate_events e
    WHERE e.review_status IN ('confirmed', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM workstation_settings WHERE id = 'default') THEN
    INSERT INTO workstation_settings (id, settings) VALUES ('default', '{}'::jsonb);
  END IF;
END $$;
