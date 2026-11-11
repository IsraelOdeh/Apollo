import { db } from "./db";
import type { ScreeningSession } from "./types";

export async function createScreeningSession(session: ScreeningSession) {
  await db.transaction(
    "rw",
    [db.screening_sessions, db.recordings],
    async () => {
      await db.screening_sessions.add(session);

      await db.recordings.update(session.recording_id, {
        screening_status: "processing",
      });
    },
  );

  return session.id;
}

export async function getScreeningSession(id: string) {
  return db.screening_sessions.get(id);
}

export async function getSessionsForRecording(recordingId: string) {
  return db.screening_sessions
    .where("recording_id")
    .equals(recordingId)
    .reverse()
    .toArray();
}

export async function completeScreeningSession(
  id: string,
  result: Partial<ScreeningSession>,
) {
  const session = await db.screening_sessions.get(id);

  if (!session) {
    throw new Error("Screening session not found");
  }

  await db.transaction(
    "rw",
    [db.screening_sessions, db.recordings],
    async () => {
      await db.screening_sessions.update(id, {
        ...result,
        status: "completed",
        completed_at: new Date(),
      });

      await db.recordings.update(session.recording_id, {
        screening_status: "screened",
      });
    },
  );
}

export async function getAllScreeningSessions() {
  return db.screening_sessions.orderBy("started_at").reverse().toArray();
}
