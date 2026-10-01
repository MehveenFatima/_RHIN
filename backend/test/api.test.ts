import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OutbreakAlert, SyncResponse } from "../../shared/types";
import { createApp } from "../src/app";
import { createGroqClient } from "../src/services/llm";
import { buildDemoReports, seedDemoData } from "../src/store/seed";
import { Store } from "../src/store/store";

const offlineLlm = createGroqClient({ apiKey: "", model: "llama-3.3-70b-versatile", baseUrl: "https://groq.test/v1", timeoutMs: 1000 });

function report(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    patientName: "Asha Test",
    age: 30,
    gender: "female",
    village: "Devpur",
    symptom: "fever",
    recordedAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

describe("REST API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = createApp({ store: await Store.open(null), llm: offlineLlm });
  });

  it("reports health and whether the LLM is configured", async () => {
    const res = await request(app).get("/api/v1/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", llm: { provider: "groq", configured: false } });
  });

  it("syncs reports idempotently and raises an alert at the threshold", async () => {
    const batch = Array.from({ length: 5 }, (_, i) => report(`r${i}`));

    const first = await request(app).post("/api/v1/reports/sync").send({ reports: batch }).expect(200);
    expect((first.body as SyncResponse).accepted).toHaveLength(5);
    expect(first.body.alertsCreated).toBe(1);

    // Replaying the same batch (e.g. after a dropped response) must not double count.
    const replay = await request(app).post("/api/v1/reports/sync").send({ reports: batch }).expect(200);
    expect(replay.body.accepted).toHaveLength(0);
    expect(replay.body.duplicates).toHaveLength(5);
    expect(replay.body.alertsCreated).toBe(0);

    const alerts = (await request(app).get("/api/v1/alerts").expect(200)).body as OutbreakAlert[];
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ village: "Devpur", symptom: "fever", caseCount: 5, status: "active" });
  });

  it("rejects invalid reports with a 400 and field-level issues", async () => {
    const res = await request(app)
      .post("/api/v1/reports/sync")
      .send({ reports: [report("x", { village: "Atlantis", age: 300 })] })
      .expect(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(["reports.0.village", "reports.0.age"]),
    );
  });

  it("runs the full district workflow: brief → edit → deploy → escalate → resolve", async () => {
    await request(app)
      .post("/api/v1/reports/sync")
      .send({ reports: Array.from({ length: 5 }, (_, i) => report(`d${i}`, { symptom: "diarrhea" })) });
    const [alert] = (await request(app).get("/api/v1/alerts")).body as OutbreakAlert[];

    const brief = (await request(app).get(`/api/v1/alerts/${alert.id}/brief`).expect(200)).body;
    expect(brief.destinationVillage).toBe("Devpur");
    expect(brief.medicines).toContain("ORS sachets");

    const edited = await request(app)
      .put(`/api/v1/alerts/${alert.id}/brief`)
      .send({ destinationVillage: "Devpur East Camp", medicines: ["ORS sachets", "Zinc tablets"] })
      .expect(200);
    expect(edited.body).toMatchObject({ destinationVillage: "Devpur East Camp", medicines: ["ORS sachets", "Zinc tablets"] });

    await request(app).put(`/api/v1/alerts/${alert.id}/brief`).send({ alertId: "hijack" }).expect(400);

    expect((await request(app).post(`/api/v1/alerts/${alert.id}/deploy`).expect(200)).body.status).toBe("in-progress");
    await request(app).post(`/api/v1/alerts/${alert.id}/deploy`).expect(409);

    const escalated = await request(app).post(`/api/v1/alerts/${alert.id}/escalate`).send({}).expect(200);
    expect(escalated.body).toMatchObject({ escalated: true, escalationReason: "Escalated by district officer." });

    expect((await request(app).post(`/api/v1/alerts/${alert.id}/resolve`).expect(200)).body.status).toBe("resolved");
    await request(app).put(`/api/v1/alerts/${alert.id}/brief`).send({ contactPoint: "x" }).expect(409);
  });

  it("generates a rule-based resource plan when the AI is not configured and deploys it", async () => {
    await request(app)
      .post("/api/v1/reports/sync")
      .send({ reports: Array.from({ length: 5 }, (_, i) => report(`p${i}`)) });
    const [alert] = (await request(app).get("/api/v1/alerts")).body as OutbreakAlert[];

    const plan = (await request(app).post(`/api/v1/alerts/${alert.id}/plans`).expect(201)).body;
    expect(plan).toMatchObject({ alertId: alert.id, source: "rules", status: "draft", staffing: { total: 3 } });

    const deployed = await request(app).post(`/api/v1/plans/${plan.id}/deploy`).expect(200);
    expect(deployed.body.status).toBe("deployed");
    expect((await request(app).get("/api/v1/analytics/stats")).body.deployedPlans).toBe(1);
  });

  it("returns rule-based triage with its source", async () => {
    const res = await request(app).post("/api/v1/ai/triage").send({ symptoms: ["cough"], notes: "cough for 3 weeks, weight loss" }).expect(200);
    expect(res.body).toMatchObject({ likelyCondition: "Suspected tuberculosis", source: "rules", referToPHC: true });
    await request(app).post("/api/v1/ai/triage").send({ symptoms: [] }).expect(400);
  });

  it("returns 404 for unknown alerts and routes", async () => {
    await request(app).get("/api/v1/alerts/missing").expect(404);
    await request(app).get("/api/v1/nope").expect(404);
  });
});

describe("demo seed + analytics", () => {
  it("produces a high, a medium and a low alert and a 7-day trend", async () => {
    const store = await Store.open(null);
    await seedDemoData(store);
    const app = createApp({ store, llm: offlineLlm });

    const alerts = (await request(app).get("/api/v1/alerts")).body as OutbreakAlert[];
    expect(alerts.map((alert) => [alert.village, alert.severity, alert.escalated])).toEqual([
      ["Rampur", "high", true],
      ["Govindpur", "medium", false],
      ["Chandanpur", "low", false],
    ]);

    const trends = (await request(app).get("/api/v1/analytics/trends")).body;
    expect(trends).toHaveLength(7);
    const total = trends.reduce((sum: number, day: Record<string, number>) => sum + day.fever + day.cough + day.diarrhea + day.rash, 0);
    // Trend buckets are UTC calendar days, so count demo reports from the start of the oldest bucket.
    const windowStart = new Date(`${trends[0].date}T00:00:00.000Z`).getTime();
    const expected = buildDemoReports().filter((r) => new Date(r.recordedAt).getTime() >= windowStart).length;
    expect(total).toBe(expected);
    expect(total).toBeGreaterThan(25);

    const top = (await request(app).get("/api/v1/analytics/top-villages")).body;
    expect(top[0]).toEqual({ village: "Rampur", cases: 11 });
  });
});

describe("JSON file persistence", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "rhin-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("survives a restart", async () => {
    const file = join(dir, "data", "rhin.json");
    const store = await Store.open(file);
    await store.syncReports([report("persist-1") as never]);

    const reopened = await Store.open(file);
    expect(reopened.listReports().map((r) => r.id)).toEqual(["persist-1"]);
    expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);
  });
});
