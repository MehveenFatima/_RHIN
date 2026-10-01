import type { Gender, NewPatientReport, Symptom } from "../../../shared/types";
import type { Store } from "./store";

/**
 * Deterministic demo data so a fresh deployment has something to show.
 * Report dates are relative to "now" and spread across the last 7 days.
 * All patient names are fictional.
 */
const CLUSTERS: { village: string; symptom: Symptom; count: number }[] = [
  { village: "Rampur", symptom: "fever", count: 11 }, // crosses the high threshold → auto-escalated
  { village: "Govindpur", symptom: "diarrhea", count: 7 }, // medium
  { village: "Chandanpur", symptom: "rash", count: 3 }, // low
  { village: "Lakshmipur", symptom: "cough", count: 3 },
  { village: "Narayanpur", symptom: "fever", count: 2 },
  { village: "Sunderpur", symptom: "diarrhea", count: 2 },
  { village: "Devpur", symptom: "fever", count: 2 },
  { village: "Devpur", symptom: "cough", count: 1 },
  { village: "Kamalpur", symptom: "fever", count: 1 },
];

const NAMES: [string, Gender][] = [
  ["Rani Devi", "female"],
  ["Suresh Kumar", "male"],
  ["Meena Bai", "female"],
  ["Raju Prasad", "male"],
  ["Lakshmi Devi", "female"],
  ["Mohan Lal", "male"],
  ["Sunita Kumari", "female"],
  ["Dinesh Yadav", "male"],
  ["Geeta Devi", "female"],
  ["Anil Sharma", "male"],
  ["Pooja Kumari", "female"],
  ["Ramesh Meena", "male"],
  ["Kavita Bai", "female"],
  ["Vijay Singh", "male"],
];
const AGES = [32, 45, 6, 55, 19, 67, 40, 3, 38, 50, 12, 71, 28, 9];

export function buildDemoReports(now: Date = new Date()): NewPatientReport[] {
  const reports: NewPatientReport[] = [];
  let index = 0;
  for (const cluster of CLUSTERS) {
    for (let i = 0; i < cluster.count; i += 1) {
      const [patientName, gender] = NAMES[index % NAMES.length];
      // Spread across the last ~6.5 days so the 7-day trend chart is populated.
      const daysAgo = (i * 6.5) / Math.max(1, cluster.count);
      const recordedAt = new Date(now.getTime() - daysAgo * 86_400_000 - ((index * 37) % 240) * 60_000);
      reports.push({
        id: `demo-${String(index + 1).padStart(3, "0")}`,
        patientName,
        gender,
        age: AGES[index % AGES.length],
        village: cluster.village,
        symptom: cluster.symptom,
        recordedAt: recordedAt.toISOString(),
      });
      index += 1;
    }
  }
  return reports;
}

export async function seedDemoData(store: Store, now: Date = new Date()): Promise<void> {
  if (!store.isEmpty) return;
  await store.syncReports(buildDemoReports(now), now);
}
