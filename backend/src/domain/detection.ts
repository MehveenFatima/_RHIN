import { randomUUID } from "node:crypto";
import type { OutbreakAlert, PatientReport, Severity, Symptom } from "../../../shared/types";

/**
 * Case-count thresholds per syndrome within the rolling window.
 * These are demonstration values chosen for the prototype — they are NOT
 * official IDSP/IHIP trigger levels, which vary by disease and population.
 */
export const THRESHOLDS: Record<Symptom, { alert: number; medium: number; high: number }> = {
  fever: { alert: 5, medium: 7, high: 10 },
  cough: { alert: 5, medium: 7, high: 10 },
  diarrhea: { alert: 5, medium: 7, high: 10 },
  // Fever-with-rash clusters (e.g. suspected measles) warrant earlier action.
  rash: { alert: 3, medium: 5, high: 8 },
};

export const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

export function severityFor(symptom: Symptom, count: number): Severity {
  const threshold = THRESHOLDS[symptom];
  if (count >= threshold.high) return "high";
  if (count >= threshold.medium) return "medium";
  return "low";
}

function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

const keyOf = (village: string, symptom: Symptom) => `${village}::${symptom}`;

export interface ClusterCount {
  village: string;
  symptom: Symptom;
  count: number;
}

/**
 * Count reports per (village, symptom) inside the rolling window.
 * Reports recorded before the most recent resolution of the same cluster are
 * ignored, so a resolved outbreak is not immediately re-raised by old cases.
 */
export function countClusters(reports: PatientReport[], alerts: OutbreakAlert[], now: Date): ClusterCount[] {
  const windowStart = now.getTime() - WINDOW_DAYS * DAY_MS;

  const lastResolved = new Map<string, number>();
  for (const alert of alerts) {
    if (alert.status !== "resolved" || !alert.resolvedAt) continue;
    const key = keyOf(alert.village, alert.symptom);
    const resolvedAt = new Date(alert.resolvedAt).getTime();
    lastResolved.set(key, Math.max(lastResolved.get(key) ?? 0, resolvedAt));
  }

  const counts = new Map<string, ClusterCount>();
  for (const report of reports) {
    const recordedAt = new Date(report.recordedAt).getTime();
    if (recordedAt < windowStart || recordedAt > now.getTime()) continue;
    const key = keyOf(report.village, report.symptom);
    if (recordedAt <= (lastResolved.get(key) ?? 0)) continue;
    const entry = counts.get(key) ?? { village: report.village, symptom: report.symptom, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }

  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export interface DetectionResult {
  alerts: OutbreakAlert[];
  created: OutbreakAlert[];
  updated: OutbreakAlert[];
}

/**
 * Pure outbreak-detection step. Given all reports and the current alerts,
 * returns the next alert list plus which alerts were created or changed.
 *
 * - A new alert is raised when a cluster reaches its `alert` threshold.
 * - An open alert tracks the live case count; its severity only ever goes up.
 * - Reaching `high` severity escalates the alert to the state level automatically.
 */
export function detectOutbreaks(
  reports: PatientReport[],
  currentAlerts: OutbreakAlert[],
  now: Date = new Date(),
  newId: () => string = randomUUID,
): DetectionResult {
  const timestamp = now.toISOString();
  const alerts = currentAlerts.map((alert) => ({ ...alert }));
  const created: OutbreakAlert[] = [];
  const updated: OutbreakAlert[] = [];

  for (const cluster of countClusters(reports, alerts, now)) {
    const open = alerts.find(
      (alert) => alert.village === cluster.village && alert.symptom === cluster.symptom && alert.status !== "resolved",
    );

    if (open) {
      const nextSeverity = maxSeverity(open.severity, severityFor(cluster.symptom, cluster.count));
      if (open.caseCount === cluster.count && open.severity === nextSeverity) continue;
      open.caseCount = cluster.count;
      open.severity = nextSeverity;
      open.updatedAt = timestamp;
      if (nextSeverity === "high" && !open.escalated) {
        open.escalated = true;
        open.escalatedAt = timestamp;
        open.escalationReason = "Automatically escalated: case count reached the high-severity threshold.";
      }
      updated.push(open);
      continue;
    }

    if (cluster.count < THRESHOLDS[cluster.symptom].alert) continue;

    const severity = severityFor(cluster.symptom, cluster.count);
    const alert: OutbreakAlert = {
      id: newId(),
      village: cluster.village,
      symptom: cluster.symptom,
      caseCount: cluster.count,
      severity,
      status: "active",
      escalated: severity === "high",
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(severity === "high"
        ? {
            escalatedAt: timestamp,
            escalationReason: "Automatically escalated: case count reached the high-severity threshold.",
          }
        : {}),
    };
    alerts.push(alert);
    created.push(alert);
  }

  return { alerts, created, updated };
}

/**
 * Short guidance shown to the field worker after a sync. When `focus` is given
 * (the reports just synced), only the clusters those reports belong to are considered.
 */
export function surveillanceGuidance(
  reports: PatientReport[],
  alerts: OutbreakAlert[],
  now: Date = new Date(),
  focus?: Pick<PatientReport, "village" | "symptom">[],
): string {
  const focusKeys = focus?.length ? new Set(focus.map((report) => keyOf(report.village, report.symptom))) : null;
  const clusters = countClusters(reports, alerts, now).filter(
    (cluster) => !focusKeys || focusKeys.has(keyOf(cluster.village, cluster.symptom)),
  );
  const [top] = clusters;
  if (!top) return "No reports in the last 7 days. Continue routine surveillance.";

  const threshold = THRESHOLDS[top.symptom].alert;
  if (top.count >= threshold) {
    return `${top.count} ${top.symptom} cases in ${top.village} in the last ${WINDOW_DAYS} days (alert threshold ${threshold}). The district team has been alerted.`;
  }
  if (top.count >= Math.max(2, threshold - 2)) {
    return `${top.count} ${top.symptom} cases in ${top.village} in the last ${WINDOW_DAYS} days — approaching the alert threshold of ${threshold}. Monitor closely.`;
  }
  return "No village is near an alert threshold. Continue routine surveillance.";
}
