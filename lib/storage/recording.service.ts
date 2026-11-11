import { db, type Recording } from "./db";

export async function saveRecording(recording: Recording) {
  await db.recordings.add(recording);

  return recording.id;
}

export async function getRecording(id: string) {
  return db.recordings.get(id);
}

export async function getAllRecordings() {
  return db.recordings.orderBy("imported_at").reverse().toArray();
}

export async function deleteRecording(id: string) {
  await db.transaction(
    "rw",
    [
      db.recordings,
      db.screening_sessions,
      db.detected_events,
      db.annotations,
      db.reports,
    ],
    async () => {
      const sessions = await db.screening_sessions
        .where("recording_id")
        .equals(id)
        .toArray();

      const sessionIds = sessions.map((s) => s.id);

      for (const sessionId of sessionIds) {
        await db.detected_events.where("session_id").equals(sessionId).delete();

        await db.annotations.where("session_id").equals(sessionId).delete();

        await db.reports.where("session_id").equals(sessionId).delete();
      }

      await db.screening_sessions.where("recording_id").equals(id).delete();

      await db.recordings.delete(id);
    },
  );
}
