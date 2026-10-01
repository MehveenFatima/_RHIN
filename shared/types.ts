/**
 * Domain types shared by the frontend (src/) and the backend (backend/src/).
 * Keeping one definition here means the API contract cannot silently drift
 * between the two sides.
 */

/** Syndromic categories a field worker can report (symptom-based, not diagnosis-based). */
export const SYMPTOMS = ["fever", "cough", "diarrhea", "rash"] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export type Severity = "low" | "medium" | "high";
export type AlertStatus = "active" | "in-progress" | "resolved";
export type Role = "asha" | "district" | "state";

/** Where an AI-assisted result came from. */
export type ResultSource = "llm" | "rules";

export interface Village {
  name: string;
  block: string;
  lat: number;
  lng: number;
}

/** A single patient report as captured by an ASHA worker (possibly offline). */
export interface PatientReport {
  /** Client-generated UUID — makes sync idempotent when a batch is replayed. */
  id: string;
  patientName: string;
  age: number;
  gender: Gender;
  village: string;
  symptom: Symptom;
  /** When the worker recorded the report on the device (ISO 8601). */
  recordedAt: string;
  /** When the server accepted the report (ISO 8601). Absent while queued offline. */
  receivedAt?: string;
}

export type NewPatientReport = Omit<PatientReport, "receivedAt">;

export interface OutbreakAlert {
  id: string;
  village: string;
  symptom: Symptom;
  caseCount: number;
  severity: Severity;
  status: AlertStatus;
  escalated: boolean;
  escalationReason?: string;
  createdAt: string;
  updatedAt: string;
  escalatedAt?: string;
  deployedAt?: string;
  resolvedAt?: string;
}

/** Dispatch instructions a district officer reviews and edits before sending a team. */
export interface DeploymentBrief {
  alertId: string;
  destinationVillage: string;
  outbreakSummary: string;
  outbreakDescription: string;
  medicines: string[];
  medicalTools: string[];
  otherRequirements: string[];
  fieldInstructions: string[];
  assemblyPoint: string;
  transportPlan: string;
  responseWindow: string;
  reportingInstructions: string;
  contactPoint: string;
  updatedAt: string;
}

export type DeploymentBriefUpdate = Partial<Omit<DeploymentBrief, "alertId" | "updatedAt">>;

export interface TriageRequest {
  symptoms: Symptom[];
  notes?: string;
  age?: number;
}

export interface TriageResult {
  likelyCondition: string;
  riskLevel: Severity;
  summary: string;
  recommendations: string[];
  redFlags: string[];
  referToPHC: boolean;
  source: ResultSource;
  model?: string;
  /** Why the rule-based fallback was used, when it was. */
  fallbackReason?: string;
}

export interface PlanItem {
  name: string;
  quantity: number;
  unit: string;
  purpose: string;
}

export interface PlanAction {
  day: number;
  action: string;
  responsible: string;
}

export interface StaffingPlan {
  doctors: number;
  nurses: number;
  fieldWorkers: number;
  total: number;
}

export interface ResourcePlan {
  id: string;
  alertId: string;
  village: string;
  symptom: Symptom;
  caseCount: number;
  condition: string;
  durationDays: number;
  medicines: PlanItem[];
  equipment: PlanItem[];
  actions: PlanAction[];
  /** Computed deterministically from case count — never taken from the model. */
  staffing: StaffingPlan;
  notes: string;
  status: "draft" | "deployed";
  source: ResultSource;
  model?: string;
  fallbackReason?: string;
  createdAt: string;
  deployedAt?: string;
}

export interface SyncResponse {
  accepted: string[];
  duplicates: string[];
  alertsCreated: number;
  alertsUpdated: number;
  guidance: string;
}

export interface DashboardStats {
  totalReports: number;
  reportsLast7Days: number;
  activeAlerts: number;
  inProgressAlerts: number;
  resolvedAlerts: number;
  escalatedAlerts: number;
  monitoredVillages: number;
  deployedPlans: number;
}

export interface TrendPoint {
  date: string;
  fever: number;
  cough: number;
  diarrhea: number;
  rash: number;
}

export interface HealthStatus {
  status: "ok";
  llm: { provider: "groq"; configured: boolean; model: string };
  time: string;
}
