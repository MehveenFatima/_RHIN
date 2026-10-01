import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { HealthStatus } from "../../../shared/types";
import { VILLAGES } from "../../../shared/villages";
import { generateResourcePlan, triage } from "../services/ai";
import type { LlmClient } from "../services/llm";
import type { Store } from "../store/store";
import { BriefUpdateSchema, DaysQuery, EscalateSchema, SyncSchema, TriageSchema } from "./schemas";

export function createApiRouter(store: Store, llm: LlmClient): Router {
  const router = Router();

  // AI endpoints call a paid/quota-limited API, so they get a stricter limit.
  const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

  router.get("/health", (_req, res) => {
    const body: HealthStatus = {
      status: "ok",
      llm: { provider: "groq", configured: llm.configured, model: llm.model },
      time: new Date().toISOString(),
    };
    res.json(body);
  });

  router.get("/villages", (_req, res) => {
    res.json(VILLAGES);
  });

  // ----- Field reports -----

  router.post("/reports/sync", async (req, res) => {
    const { reports } = SyncSchema.parse(req.body);
    res.json(await store.syncReports(reports));
  });

  router.get("/reports", (req, res) => {
    const { days } = DaysQuery.parse(req.query);
    res.json(store.listReports(days));
  });

  // ----- Outbreak alerts -----

  router.get("/alerts", (_req, res) => {
    res.json(store.listAlerts());
  });

  router.get("/alerts/:id", (req, res) => {
    res.json(store.getAlert(req.params.id));
  });

  router.post("/alerts/:id/deploy", async (req, res) => {
    res.json(await store.deployTeam(req.params.id));
  });

  router.post("/alerts/:id/escalate", async (req, res) => {
    const { reason } = EscalateSchema.parse(req.body ?? {});
    res.json(await store.escalate(req.params.id, reason || "Escalated by district officer."));
  });

  router.post("/alerts/:id/resolve", async (req, res) => {
    res.json(await store.resolve(req.params.id));
  });

  router.get("/alerts/:id/brief", (req, res) => {
    res.json(store.getBrief(req.params.id));
  });

  router.put("/alerts/:id/brief", async (req, res) => {
    const update = BriefUpdateSchema.parse(req.body);
    res.json(await store.updateBrief(req.params.id, update));
  });

  // ----- Resource plans (state level) -----

  router.post("/alerts/:id/plans", aiLimiter, async (req, res) => {
    const alert = store.getAlert(String(req.params.id));
    const plan = await generateResourcePlan(llm, alert);
    res.status(201).json(await store.savePlan(alert, plan));
  });

  router.get("/plans", (_req, res) => {
    res.json(store.listPlans());
  });

  router.post("/plans/:id/deploy", async (req, res) => {
    res.json(await store.deployPlan(req.params.id));
  });

  // ----- AI-assisted triage (field level) -----

  router.post("/ai/triage", aiLimiter, async (req, res) => {
    const request = TriageSchema.parse(req.body);
    res.json(await triage(llm, request));
  });

  // ----- Analytics -----

  router.get("/analytics/stats", (_req, res) => {
    res.json(store.stats());
  });

  router.get("/analytics/trends", (req, res) => {
    const { days } = DaysQuery.parse(req.query);
    res.json(store.trends(days ?? 7));
  });

  router.get("/analytics/top-villages", (req, res) => {
    const { days } = DaysQuery.parse(req.query);
    res.json(store.topVillages(5, days ?? 7));
  });

  return router;
}
