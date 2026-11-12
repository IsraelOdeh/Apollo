"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/storage/db";

export function useRecording(id: string) {
  const recording = useLiveQuery(() => db.recordings.get(id), [id], null);

  return recording;
}

export function useRecordings() {
  const recordings = useLiveQuery(
    () => db.recordings.orderBy("imported_at").reverse().toArray(),
    [],
    [],
  );

  return recordings;
}

export function useRecordingCount() {
  const count = useLiveQuery(() => db.recordings.count(), [], 0);

  return count;
}

export function usePendingReviewCount() {
  const count = useLiveQuery(
    () =>
      db.recordings.where("screening_status").equals("review_pending").count(),
    [],
    0,
  );

  return count;
}
