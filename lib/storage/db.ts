import Dexie, { type EntityTable } from "dexie";

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
  recording_date: Date;
  imported_at: Date;
  source: "upload" | "hardware";
  quality_status: "unknown" | "good" | "poor" | "review_required";
  screening_status:
    | "imported"
    | "processing"
    | "screened"
    | "review_pending"
    | "reviewed"
    | "archived";
}

export interface ScreeningSession {
  id: string;
  recording_id: string;
  model_name: string;
  model_version: string;
  started_at: Date;
  completed_at?: Date;
  preprocessing_config: Record<string, unknown>;
  status: string;
  overall_result?: string;
  quality_score?: number;
  inference_duration?: number;
}

export interface DetectedEvent {
  id: string;
  session_id: string;
  event_type: string;
  start_time: number;
  end_time: number;
  channels: string[];
  confidence: number;
  review_status: string;
  created_at: Date;
}

export interface Annotation {
  id: string;
  event_id: string;
  session_id: string;
  annotation_type: string;
  notes: string;
  reviewer_id?: string;
  created_at: Date;
}

export interface Report {
  id: string;
  session_id: string;
  report_type: string;
  report_data: Record<string, unknown>;
  generated_at: Date;
  export_format: string;
}

export interface SyncQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: "create" | "update";
  status: "pending" | "syncing" | "failed" | "synced";
  retry_count: number;
  created_at: Date;
  last_attempt?: Date;
  error_message?: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

class NeuroEdgeDatabase extends Dexie {
  recordings!: EntityTable<Recording, "id">;
  screening_sessions!: EntityTable<ScreeningSession, "id">;
  detected_events!: EntityTable<DetectedEvent, "id">;
  annotations!: EntityTable<Annotation, "id">;
  reports!: EntityTable<Report, "id">;
  sync_queue!: EntityTable<SyncQueueItem, "id">;
  app_settings!: EntityTable<AppSetting, "key">;

  constructor() {
    super("NeuroEdgeDB");

    this.version(1).stores({
      recordings: "id, recording_date, screening_status, imported_at",

      screening_sessions: "id, recording_id, status, started_at",

      detected_events: "id, session_id, event_type, review_status",

      annotations: "id, event_id, session_id, created_at",

      reports: "id, session_id, generated_at",

      sync_queue: "id, entity_type, entity_id, status, created_at",

      app_settings: "key",
    });
  }
}

export const db = new NeuroEdgeDatabase();
