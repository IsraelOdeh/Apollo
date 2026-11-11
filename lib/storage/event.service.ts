import { db } from "./db";
import type { DetectedEvent, Annotation } from "./types";

export async function saveDetectedEvents(events: DetectedEvent[]) {
  await db.detected_events.bulkPut(events);
}

export async function getEventsForSession(sessionId: string) {
  return db.detected_events
    .where("session_id")
    .equals(sessionId)
    .sortBy("start_time");
}

export async function updateEventReview(
  eventId: string,
  status: DetectedEvent["review_status"],
) {
  const event = await db.detected_events.get(eventId);

  if (!event) {
    throw new Error("Event not found");
  }

  await db.transaction("rw", [db.detected_events, db.annotations], async () => {
    await db.detected_events.update(eventId, {
      review_status: status,
    });

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      event_id: eventId,
      session_id: event.session_id,
      annotation_type: status,
      notes: "",
      created_at: new Date(),
    };

    await db.annotations.add(annotation);
  });
}

export async function addEventAnnotation(annotation: Annotation) {
  await db.annotations.add(annotation);
}

export async function getAnnotationsForSession(sessionId: string) {
  return db.annotations.where("session_id").equals(sessionId).toArray();
}
