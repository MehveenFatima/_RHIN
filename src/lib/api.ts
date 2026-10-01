import type {
  DashboardStats,
  DeploymentBrief,
  DeploymentBriefUpdate,
  HealthStatus,
  NewPatientReport,
  OutbreakAlert,
  ResourcePlan,
  SyncResponse,
  TrendPoint,
  TriageRequest,
  TriageResult,
  Village,
} from "@shared/types";

const API_ROOT = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api/v1`;

/** `status` is 0 when the request never reached the server (offline, DNS, CORS, server down). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError("Cannot reach the RHIN server", 0);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body && typeof body.message === "string" && body.message) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => request<HealthStatus>("/health"),
  villages: () => request<Village[]>("/villages"),

  syncReports: (reports: NewPatientReport[]) => post<SyncResponse>("/reports/sync", { reports }),

  alerts: () => request<OutbreakAlert[]>("/alerts"),
  deployTeam: (alertId: string) => post<OutbreakAlert>(`/alerts/${alertId}/deploy`),
  escalate: (alertId: string, reason?: string) => post<OutbreakAlert>(`/alerts/${alertId}/escalate`, { reason }),
  resolve: (alertId: string) => post<OutbreakAlert>(`/alerts/${alertId}/resolve`),
  brief: (alertId: string) => request<DeploymentBrief>(`/alerts/${alertId}/brief`),
  updateBrief: (alertId: string, update: DeploymentBriefUpdate) =>
    request<DeploymentBrief>(`/alerts/${alertId}/brief`, { method: "PUT", body: JSON.stringify(update) }),

  generatePlan: (alertId: string) => post<ResourcePlan>(`/alerts/${alertId}/plans`),
  plans: () => request<ResourcePlan[]>("/plans"),
  deployPlan: (planId: string) => post<ResourcePlan>(`/plans/${planId}/deploy`),

  triage: (input: TriageRequest) => post<TriageResult>("/ai/triage", input),

  stats: () => request<DashboardStats>("/analytics/stats"),
  trends: (days = 7) => request<TrendPoint[]>(`/analytics/trends?days=${days}`),
  topVillages: (days = 7) => request<{ village: string; cases: number }[]>(`/analytics/top-villages?days=${days}`),
};
