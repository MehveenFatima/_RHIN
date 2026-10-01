import { z } from "zod";
import type { OutbreakAlert, PlanItem, TriageRequest, TriageResult } from "../../../shared/types";
import { computeStaffing, ruleBasedPlan, type PlanBody } from "../domain/resourceRules";
import { ruleBasedTriage } from "../domain/triageRules";
import { LlmError, type LlmClient } from "./llm";

const SAFETY_NOTE =
  "You support ASHA (community health) workers in rural India. You do not diagnose; you suggest a likely condition, " +
  "risk level and next steps aligned with Indian public-health practice. Be concise and practical. " +
  "Never recommend antibiotics without clinical assessment. Respond with a single JSON object only.";

const TriageSchema = z.object({
  likelyCondition: z.string().min(2).max(120),
  riskLevel: z.enum(["low", "medium", "high"]),
  summary: z.string().min(5).max(600),
  recommendations: z.array(z.string().min(2).max(240)).min(1).max(6),
  redFlags: z.array(z.string().min(2).max(160)).max(6),
  referToPHC: z.boolean(),
});

export async function triage(llm: LlmClient, request: TriageRequest, log = console): Promise<TriageResult> {
  if (!llm.configured) return ruleBasedTriage(request, "AI service not configured");

  const user = [
    `Reported symptoms: ${request.symptoms.length ? request.symptoms.join(", ") : "none selected"}`,
    `Patient age: ${request.age ?? "not given"}`,
    `Field worker notes: ${request.notes?.trim() || "none"}`,
    "",
    "Return JSON with exactly these keys:",
    '{"likelyCondition": string, "riskLevel": "low"|"medium"|"high", "summary": string (max 2 sentences),',
    ' "recommendations": string[] (2-5 short actions), "redFlags": string[] (danger signs that need urgent referral),',
    ' "referToPHC": boolean}',
  ].join("\n");

  try {
    const result = await llm.completeJson({ system: SAFETY_NOTE, user, schema: TriageSchema, maxTokens: 600 });
    return { ...result, source: "llm", model: llm.model };
  } catch (error) {
    const reason = error instanceof LlmError ? error.message : "Unexpected AI error";
    log.warn(`[ai] triage fell back to rules: ${reason}`);
    return ruleBasedTriage(request, reason);
  }
}

const ItemSchema = z.object({
  name: z.string().min(2).max(120),
  quantity: z.coerce.number().nonnegative().max(1_000_000),
  unit: z.string().min(1).max(40),
  purpose: z.string().min(2).max(200),
});

const PlanSchema = z.object({
  condition: z.string().min(2).max(120),
  durationDays: z.coerce.number().int().min(1).max(60),
  medicines: z.array(ItemSchema).min(1).max(10),
  equipment: z.array(ItemSchema).min(1).max(10),
  actions: z
    .array(z.object({ day: z.coerce.number().int().min(1).max(60), action: z.string().min(2).max(240), responsible: z.string().min(2).max(60) }))
    .min(1)
    .max(12),
  notes: z.string().max(600).default(""),
});

export interface GeneratedPlan extends PlanBody {
  staffing: ReturnType<typeof computeStaffing>;
  source: "llm" | "rules";
  model?: string;
  fallbackReason?: string;
}

const roundItems = (items: PlanItem[]) => items.map((item) => ({ ...item, quantity: Math.ceil(item.quantity) }));

export async function generateResourcePlan(llm: LlmClient, alert: OutbreakAlert, log = console): Promise<GeneratedPlan> {
  const staffing = computeStaffing(alert.caseCount);
  const fallback = (reason: string): GeneratedPlan => ({
    ...ruleBasedPlan(alert.symptom, alert.caseCount),
    staffing,
    source: "rules",
    fallbackReason: reason,
  });

  if (!llm.configured) return fallback("AI service not configured");

  const user = [
    `Outbreak alert: ${alert.caseCount} cases of ${alert.symptom} reported in ${alert.village} village within 7 days.`,
    `Severity: ${alert.severity}. The response team is ${staffing.doctors} doctors, ${staffing.nurses} nurses and ${staffing.fieldWorkers} field workers.`,
    "Plan medicines and equipment for 10-14 days for the affected cases plus prevention for the village.",
    "",
    "Return JSON with exactly these keys:",
    '{"condition": string, "durationDays": integer,',
    ' "medicines": [{"name": string, "quantity": number, "unit": string, "purpose": string}],',
    ' "equipment": [{"name": string, "quantity": number, "unit": string, "purpose": string}],',
    ' "actions": [{"day": integer, "action": string, "responsible": "Doctor"|"Nurses"|"Field workers"}],',
    ' "notes": string}',
  ].join("\n");

  try {
    const plan = await llm.completeJson({ system: SAFETY_NOTE, user, schema: PlanSchema, maxTokens: 1500 });
    return {
      ...plan,
      medicines: roundItems(plan.medicines),
      equipment: roundItems(plan.equipment),
      actions: [...plan.actions].sort((a, b) => a.day - b.day),
      staffing,
      source: "llm",
      model: llm.model,
    };
  } catch (error) {
    const reason = error instanceof LlmError ? error.message : "Unexpected AI error";
    log.warn(`[ai] resource plan fell back to rules: ${reason}`);
    return fallback(reason);
  }
}
