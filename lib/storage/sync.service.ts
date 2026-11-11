// import { db } from "./db";
// import type { SyncQueueItem } from "./types";

// export async function queueSync(item: SyncQueueItem) {
//   await db.sync_queue.put(item);
// }

// export async function getPendingSyncItems() {
//   return db.sync_queue.where("status").anyOf(["pending", "failed"]).toArray();
// }

// export async function updateSyncStatus(
//   id: string,
//   status: SyncQueueItem["status"],
//   errorMessage?: string,
// ) {
//   await db.sync_queue.update(id, {
//     status,
//     last_attempt: new Date(),
//     retry_count:
//       status === "failed"
//         ? 1 // Replace with an increment based on the existing record below.
//         : undefined,
//     error_message: errorMessage,
//   });
// }

// export async function getSyncStatistics() {
//   const [pending, failed, synced] = await Promise.all([
//     db.sync_queue.where("status").equals("pending").count(),
//     db.sync_queue.where("status").equals("failed").count(),
//     db.sync_queue.where("status").equals("synced").count(),
//   ]);

//   return { pending, failed, synced };
// }
