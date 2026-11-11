export type RecordingSource = "upload" | "hardware";

export type RecordingStatus =
  | "imported"
  | "processing"
  | "screened"
  | "review_pending"
  | "reviewed"
  | "archived";

export type SessionStatus = "pending" | "processing" | "completed" | "failed";

export type EventType = "ied_candidate" | "seizure_candidate" | "artifact";

export type ReviewStatus = "pending" | "accepted" | "rejected" | "uncertain";

export interface Recording {
  id: string;
  recording_name: string;
  file_blob: Blob;
  file_format: "EDF" | "EDF+";
  file_size: number;
  sampling_rate: number;
  channel_count: number;
  channels: string[];
  duration: number;
  recording_date: Date | null;
  imported_at: Date;
  source: RecordingSource;
  quality_status: "unknown" | "good" | "poor" | "review_required";
  screening_status: RecordingStatus;
}

export interface ScreeningSession {
  id: string;
  recording_id: string;
  model_name: string;
  model_version: string;
  started_at: Date;
  completed_at?: Date;
  preprocessing_config: Record<string, unknown>;
  status: SessionStatus;
  overall_result?: string;
  quality_score?: number;
  inference_duration?: number;
}

export interface DetectedEvent {
  id: string;
  session_id: string;
  event_type: EventType;
  start_time: number;
  end_time: number;
  channels: string[];
  confidence: number;
  review_status: ReviewStatus;
  created_at: Date;
}

export interface Annotation {
  id: string;
  event_id: string;
  session_id: string;
  annotation_type: ReviewStatus;
  notes: string;
  reviewer_id?: string;
  created_at: Date;
}

export interface ScreeningReport {
  id: string;
  session_id: string;
  report_type: string;
  report_data: Record<string, unknown>;
  generated_at: Date;
  export_format: "PDF" | "JSON" | "CSV";
}

export interface SyncQueueItem {
  id: string;
  entity_type: "recording" | "session" | "event" | "annotation" | "report";
  entity_id: string;
  operation: "create" | "update" | "delete";
  status: "pending" | "syncing" | "failed" | "synced";
  retry_count: number;
  created_at: Date;
  last_attempt?: Date;
  error_message?: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: Date;
}
