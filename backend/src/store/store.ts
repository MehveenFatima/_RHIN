import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  DashboardStats,
  DeploymentBrief,
  DeploymentBriefUpdate,
  NewPatientReport,
  OutbreakAlert,
  PatientReport,
  ResourcePlan,
  SyncResponse,
  TrendPoint,
} from "../../../shared/types";
import { createDeploymentBrief } from "../domain/briefs";
import { detectOutbreaks, surveillanceGuidance } from "../domain/detection";
import type { GeneratedPlan } from "../services/ai";

interface Snapshot {
  version: 1;
  reports: PatientReport[];
  alerts: OutbreakAlert[];
  briefs: Record<string, DeploymentBrief>;
  plans: ResourcePlan[];
}

const emptySnapshot = (): Snapshot => ({ version: 1, reports: [], alerts: [], briefs: {}, plans: [] });
const DAY_MS = 24 * 60 * 60 * 1000;

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

/**
 * Data tier. Holds state in memory and persists every mutation to a JSON file
 * (write to a temp file, then atomic rename). With `file = null` it runs purely
 * in memory, which is what the tests use.
 *
 * A JSON file keeps the prototype dependency-free to run and deploy; the class
 * boundary is where a database (e.g. PostgreSQL) would plug in.
 */
export class Store {
  private state: Snapshot;
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly file: string | null,
    state: Snapshot,
  ) {
    this.state = state;
  }

  static async open(file: string | null): Promise<Store> {
    if (!file) return new Store(null, emptySnapshot());
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as Snapshot;
      return new Store(file, { ...emptySnapshot(), ...parsed });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Store(file, emptySnapshot());
      throw error;
    }
  }

  get isEmpty(): boolean {
    return this.state.reports.length === 0 && this.state.alerts.length === 0;
  }

  private persist(): Promise<void> {
    const file = this.file;
    if (!file) return Promise.resolve();
    const data = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, data, "utf8");
      await rename(tmp, file);
    });
    return this.writeQueue;
  }

  // ---------- Reports & detection ----------

  /** Idempotent: reports whose id is already stored are skipped, so a replayed batch is safe. */
  async syncReports(incoming: NewPatientReport[], now: Date = new Date()): Promise<SyncResponse> {
    const known = new Set(this.state.reports.map((report) => report.id));
    const accepted: string[] = [];
    const duplicates: string[] = [];

    for (const report of incoming) {
      if (known.has(report.id)) {
        duplicates.push(report.id);
        continue;
      }
      known.add(report.id);
      accepted.push(report.id);
      this.state.reports.push({ ...report, receivedAt: now.toISOString() });
    }

    const { created, updated } = this.runDetection(now);
    await this.persist();

    return {
      accepted,
      duplicates,
      alertsCreated: created.length,
      alertsUpdated: updated.length,
      guidance: surveillanceGuidance(
        this.state.reports,
        this.state.alerts,
        now,
        incoming.filter((report) => accepted.includes(report.id)),
      ),
    };
  }

  private runDetection(now: Date) {
    const result = detectOutbreaks(this.state.reports, this.state.alerts, now);
    this.state.alerts = result.alerts;
    for (const alert of result.created) {
      this.state.briefs[alert.id] = createDeploymentBrief(alert, now);
    }
    return result;
  }

  listReports(days?: number, now: Date = new Date()): PatientReport[] {
    const since = days ? now.getTime() - days * DAY_MS : -Infinity;
    return this.state.reports
      .filter((report) => new Date(report.recordedAt).getTime() >= since)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }

  // ---------- Alerts ----------

  listAlerts(): OutbreakAlert[] {
    const statusOrder = { active: 0, "in-progress": 1, resolved: 2 } as const;
    const severityOrder = { high: 0, medium: 1, low: 2 } as const;
    return [...this.state.alerts].sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        severityOrder[a.severity] - severityOrder[b.severity] ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  getAlert(id: string): OutbreakAlert {
    const alert = this.state.alerts.find((item) => item.id === id);
    if (!alert) throw new NotFoundError(`Alert ${id} not found`);
    return alert;
  }

  async deployTeam(id: string, now: Date = new Date()): Promise<OutbreakAlert> {
    const alert = this.getAlert(id);
    if (alert.status !== "active") throw new ConflictError(`Alert is already ${alert.status}`);
    alert.status = "in-progress";
    alert.deployedAt = now.toISOString();
    alert.updatedAt = now.toISOString();
    await this.persist();
    return alert;
  }

  async escalate(id: string, reason: string, now: Date = new Date()): Promise<OutbreakAlert> {
    const alert = this.getAlert(id);
    if (alert.status === "resolved") throw new ConflictError("Resolved alerts cannot be escalated");
    if (alert.escalated) return alert;
    alert.escalated = true;
    alert.escalatedAt = now.toISOString();
    alert.escalationReason = reason;
    alert.updatedAt = now.toISOString();
    await this.persist();
    return alert;
  }

  async resolve(id: string, now: Date = new Date()): Promise<OutbreakAlert> {
    const alert = this.getAlert(id);
    if (alert.status === "resolved") return alert;
    alert.status = "resolved";
    alert.resolvedAt = now.toISOString();
    alert.updatedAt = now.toISOString();
    await this.persist();
    return alert;
  }

  // ---------- Deployment briefs ----------

  getBrief(alertId: string): DeploymentBrief {
    const alert = this.getAlert(alertId);
    this.state.briefs[alertId] ??= createDeploymentBrief(alert);
    return this.state.briefs[alertId];
  }

  async updateBrief(alertId: string, update: DeploymentBriefUpdate, now: Date = new Date()): Promise<DeploymentBrief> {
    const alert = this.getAlert(alertId);
    if (alert.status === "resolved") throw new ConflictError("Briefs of resolved alerts are read-only");
    const next: DeploymentBrief = { ...this.getBrief(alertId), ...update, alertId, updatedAt: now.toISOString() };
    this.state.briefs[alertId] = next;
    await this.persist();
    return next;
  }

  // ---------- Resource plans ----------

  async savePlan(alert: OutbreakAlert, plan: GeneratedPlan, now: Date = new Date()): Promise<ResourcePlan> {
    const stored: ResourcePlan = {
      ...plan,
      id: randomUUID(),
      alertId: alert.id,
      village: alert.village,
      symptom: alert.symptom,
      caseCount: alert.caseCount,
      status: "draft",
      createdAt: now.toISOString(),
    };
    this.state.plans.push(stored);
    await this.persist();
    return stored;
  }

  listPlans(): ResourcePlan[] {
    return [...this.state.plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deployPlan(id: string, now: Date = new Date()): Promise<ResourcePlan> {
    const plan = this.state.plans.find((item) => item.id === id);
    if (!plan) throw new NotFoundError(`Plan ${id} not found`);
    if (plan.status === "deployed") throw new ConflictError("Plan is already deployed");
    plan.status = "deployed";
    plan.deployedAt = now.toISOString();
    await this.persist();
    return plan;
  }

  // ---------- Analytics ----------

  stats(now: Date = new Date()): DashboardStats {
    const alerts = this.state.alerts;
    return {
      totalReports: this.state.reports.length,
      reportsLast7Days: this.listReports(7, now).length,
      activeAlerts: alerts.filter((alert) => alert.status === "active").length,
      inProgressAlerts: alerts.filter((alert) => alert.status === "in-progress").length,
      resolvedAlerts: alerts.filter((alert) => alert.status === "resolved").length,
      escalatedAlerts: alerts.filter((alert) => alert.escalated && alert.status !== "resolved").length,
      monitoredVillages: new Set(this.state.reports.map((report) => report.village)).size,
      deployedPlans: this.state.plans.filter((plan) => plan.status === "deployed").length,
    };
  }

  /** Daily report counts per syndrome for the last `days` calendar days (UTC), oldest first. */
  trends(days = 7, now: Date = new Date()): TrendPoint[] {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const points: TrendPoint[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const start = today - offset * DAY_MS;
      const point: TrendPoint = { date: new Date(start).toISOString().slice(0, 10), fever: 0, cough: 0, diarrhea: 0, rash: 0 };
      for (const report of this.state.reports) {
        const time = new Date(report.recordedAt).getTime();
        if (time >= start && time < start + DAY_MS) point[report.symptom] += 1;
      }
      points.push(point);
    }
    return points;
  }

  topVillages(limit = 5, days = 7, now: Date = new Date()): { village: string; cases: number }[] {
    const counts = new Map<string, number>();
    for (const report of this.listReports(days, now)) counts.set(report.village, (counts.get(report.village) ?? 0) + 1);
    return [...counts.entries()]
      .map(([village, cases]) => ({ village, cases }))
      .sort((a, b) => b.cases - a.cases)
      .slice(0, limit);
  }
}
