export type Quality = 'good' | 'fair' | 'poor';
export type ScreeningStatus = 'not_screened' | 'processing' | 'screened' | 'failed';
export type ReviewStatus = 'unreviewed' | 'in_review' | 'reviewed';
export type SyncStatus = 'local' | 'pending' | 'synced' | 'failed';
export type EventType = 'ied_candidate' | 'artifact' | 'review_segment';
export type EventReviewStatus = 'pending' | 'marked' | 'confirmed' | 'rejected';
export type ReviewAction = 'marked' | 'confirmed' | 'rejected' | 'note_added';

export type ProcessingConfig = {
  highPassHz?: number;
  lowPassHz?: number;
  notchHz?: number;
};

export type Recording = {
  id: string;
  pseudonym_id: string;
  source_kind: 'demo' | 'imported';
  file_name: string | null;
  file_size_bytes: number | null;
  channel_labels: string[];
  channel_count: number;
  sampling_hz: number;
  duration_seconds: number;
  recorded_at: string;
  quality: Quality;
  screening_status: ScreeningStatus;
  review_status: ReviewStatus;
  model_version: string | null;
  processing_config: ProcessingConfig;
  sync_status: SyncStatus;
  created_at: string;
};

export type CandidateEvent = {
  id: string;
  recording_id: string;
  event_type: EventType;
  start_seconds: number;
  duration_seconds: number;
  channels: string[];
  confidence: number | null;
  signal_quality: Quality;
  source: 'model' | 'human';
  review_status: EventReviewStatus;
  clinical_note: string;
  model_version: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewActionRecord = {
  id: string;
  event_id: string;
  action: ReviewAction;
  note: string;
  created_at: string;
};

export type WorkstationSettings = {
  filters: {
    highPassHz: number;
    lowPassHz: number;
    notchHz: number;
  };
  candidateThreshold: number;
  artifactThresholdMicrovolts: number;
  autoSync: boolean;
  displayName: string;
  defaultWindowSeconds: number;
  reducedMotion: boolean;
};
