import { describe, expect, it, vi } from "vitest";
import type { OutbreakAlert } from "../../shared/types";
import { generateResourcePlan, triage } from "../src/services/ai";
import { createGroqClient } from "../src/services/llm";

const silentLog = { warn: vi.fn() } as unknown as Console;

const config = { apiKey: "test-key", model: "llama-3.3-70b-versatile", baseUrl: "https://groq.test/v1", timeoutMs: 1000 };

function groqReply(content: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

const alert: OutbreakAlert = {
  id: "a1",
  village: "Rampur",
  symptom: "fever",
  caseCount: 24,
  severity: "high",
  status: "active",
  escalated: true,
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
};

describe("triage", () => {
  it("returns the validated LLM result and sends a JSON-mode request", async () => {
    const fetchMock = groqReply({
      likelyCondition: "Suspected dengue",
      riskLevel: "high",
      summary: "Fever with rash.",
      recommendations: ["Refer for NS1 test", "Give ORS"],
      redFlags: ["Bleeding"],
      referToPHC: true,
    });
    const result = await triage(createGroqClient(config, fetchMock), { symptoms: ["fever", "rash"] }, silentLog);

    expect(result).toMatchObject({ likelyCondition: "Suspected dengue", riskLevel: "high", source: "llm" });
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://groq.test/v1/chat/completions");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("falls back to rules when the key is missing, without calling the API", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const result = await triage(createGroqClient({ ...config, apiKey: "" }, fetchMock), { symptoms: ["diarrhea"], notes: "watery" }, silentLog);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.source).toBe("rules");
    expect(result.fallbackReason).toBe("AI service not configured");
    expect(result.likelyCondition).toMatch(/diarrhoea/i);
  });

  it("falls back to rules when the model returns the wrong shape", async () => {
    const result = await triage(createGroqClient(config, groqReply({ disease: "dengue" })), { symptoms: ["fever"] }, silentLog);
    expect(result.source).toBe("rules");
    expect(result.fallbackReason).toMatch(/schema/);
  });

  it("falls back to rules when the model returns non-JSON text", async () => {
    const result = await triage(createGroqClient(config, groqReply("Disease: dengue")), { symptoms: ["fever"] }, silentLog);
    expect(result.fallbackReason).toMatch(/not valid JSON/);
  });

  it("falls back to rules on HTTP errors and network failures", async () => {
    const http = await triage(createGroqClient(config, groqReply({}, 401)), { symptoms: ["cough"] }, silentLog);
    expect(http.fallbackReason).toBe("Groq returned HTTP 401");

    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const network = await triage(createGroqClient(config, failing), { symptoms: ["cough"] }, silentLog);
    expect(network.fallbackReason).toMatch(/network error/);
  });

  it("adds caution for vulnerable age groups in the rule-based path", async () => {
    const result = await triage(createGroqClient({ ...config, apiKey: "" }), { symptoms: ["rash"], notes: "itching", age: 3 }, silentLog);
    expect(result.riskLevel).toBe("medium");
  });
});

describe("generateResourcePlan", () => {
  it("uses the model for items but computes staffing deterministically", async () => {
    const fetchMock = groqReply({
      condition: "Dengue",
      durationDays: 14,
      medicines: [{ name: "Paracetamol", quantity: 480.4, unit: "tablets", purpose: "Fever" }],
      equipment: [{ name: "NS1 kits", quantity: "30", unit: "kits", purpose: "Testing" }],
      actions: [
        { day: 3, action: "Fogging", responsible: "Field workers" },
        { day: 1, action: "Screen cases", responsible: "Nurses" },
      ],
      notes: "Avoid NSAIDs",
    });
    const plan = await generateResourcePlan(createGroqClient(config, fetchMock), alert, silentLog);

    expect(plan.source).toBe("llm");
    expect(plan.staffing).toEqual({ doctors: 1, nurses: 2, fieldWorkers: 3, total: 6 });
    expect(plan.medicines[0].quantity).toBe(481);
    expect(plan.equipment[0].quantity).toBe(30);
    expect(plan.actions.map((action) => action.day)).toEqual([1, 3]);
  });

  it("falls back to the syndrome template when the AI is unavailable", async () => {
    const plan = await generateResourcePlan(createGroqClient({ ...config, apiKey: "" }), { ...alert, symptom: "diarrhea" }, silentLog);
    expect(plan.source).toBe("rules");
    expect(plan.condition).toMatch(/diarrhoeal/i);
    expect(plan.medicines.find((item) => item.name === "ORS sachets")?.quantity).toBe(24 * 15);
  });
});
