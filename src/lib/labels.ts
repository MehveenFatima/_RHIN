import type { AlertStatus, Severity, Symptom } from "@shared/types";

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  fever: "Fever",
  cough: "Cough",
  diarrhea: "Diarrhoea",
  rash: "Rash",
};

export const SEVERITY_LABELS: Record<Severity, string> = { low: "Low", medium: "Medium", high: "High" };

export const STATUS_LABELS: Record<AlertStatus, string> = {
  active: "Active",
  "in-progress": "Team deployed",
  resolved: "Resolved",
};

/** Chart/map colours per syndrome, matched to the CSS theme tokens. */
export const SYMPTOM_COLORS: Record<Symptom, string> = {
  fever: "hsl(0 72% 51%)",
  diarrhea: "hsl(38 92% 50%)",
  cough: "hsl(199 89% 48%)",
  rash: "hsl(280 60% 50%)",
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  high: "hsl(0 72% 51%)",
  medium: "hsl(25 95% 53%)",
  low: "hsl(45 93% 47%)",
};

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatDay(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
