import { db } from "./db";
import type { ScreeningReport } from "./types";

export async function saveReport(report: ScreeningReport) {
  await db.reports.add(report);
  return report.id;
}

export async function getReport(id: string) {
  return db.reports.get(id);
}

export async function getReportsForSession(sessionId: string) {
  return db.reports.where("session_id").equals(sessionId).toArray();
}

export async function getAllReports() {
  return db.reports.orderBy("generated_at").reverse().toArray();
}
