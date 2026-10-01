import type { NewPatientReport, SyncResponse } from "@shared/types";
import { api } from "./api";

/**
 * Device-local queue of patient reports that have not reached the server yet.
 *
 * Every report gets a UUID when it is captured. The server ignores ids it has
 * already stored, so replaying a batch after a dropped connection or a crash
 * mid-sync can never double-count cases.
 */
const STORAGE_KEY = "rhin.offlineQueue.v1";
const BATCH_SIZE = 200;

function read(): NewPatientReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(queue: NewPatientReport[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getQueue(): NewPatientReport[] {
  return read();
}

export function enqueue(report: Omit<NewPatientReport, "id" | "recordedAt">): NewPatientReport {
  const entry: NewPatientReport = {
    ...report,
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
  };
  write([...read(), entry]);
  return entry;
}

export function removeFromQueue(ids: Iterable<string>) {
  const done = new Set(ids);
  write(read().filter((report) => !done.has(report.id)));
}

/**
 * Send queued reports in batches. Reports the server accepted *or* already had
 * are removed; anything else stays queued for the next attempt. Throws the
 * first error so callers can show it, after keeping whatever already succeeded.
 */
export async function flushQueue(): Promise<SyncResponse | null> {
  const queue = read();
  if (queue.length === 0) return null;

  const total: SyncResponse = { accepted: [], duplicates: [], alertsCreated: 0, alertsUpdated: 0, guidance: "" };
  for (let start = 0; start < queue.length; start += BATCH_SIZE) {
    const batch = queue.slice(start, start + BATCH_SIZE);
    const result = await api.syncReports(batch);
    removeFromQueue([...result.accepted, ...result.duplicates]);
    total.accepted.push(...result.accepted);
    total.duplicates.push(...result.duplicates);
    total.alertsCreated += result.alertsCreated;
    total.alertsUpdated += result.alertsUpdated;
    total.guidance = result.guidance;
  }
  return total;
}
