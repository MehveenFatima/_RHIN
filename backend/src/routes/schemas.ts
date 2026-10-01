import { z } from "zod";
import { GENDERS, SYMPTOMS } from "../../../shared/types";
import { VILLAGE_NAMES } from "../../../shared/villages";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const ReportSchema = z.object({
  id: z.string().trim().min(1).max(64),
  patientName: z.string().trim().min(1).max(80),
  age: z.number().int().min(0).max(120),
  gender: z.enum(GENDERS),
  village: z.string().refine((village) => VILLAGE_NAMES.includes(village), "Unknown village"),
  symptom: z.enum(SYMPTOMS),
  recordedAt: z.iso
    .datetime()
    .refine((value) => new Date(value).getTime() <= Date.now() + MAX_CLOCK_SKEW_MS, "recordedAt is in the future"),
});

export const SyncSchema = z.object({
  reports: z.array(ReportSchema).min(1).max(500),
});

const text = (max: number) => z.string().trim().min(1).max(max);
const list = z.array(text(200)).max(30);

export const BriefUpdateSchema = z
  .object({
    destinationVillage: text(120),
    outbreakSummary: text(200),
    outbreakDescription: text(2000),
    medicines: list,
    medicalTools: list,
    otherRequirements: list,
    fieldInstructions: list,
    assemblyPoint: text(200),
    transportPlan: text(500),
    responseWindow: text(120),
    reportingInstructions: text(1000),
    contactPoint: text(200),
  })
  .partial()
  .strict();

export const EscalateSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const TriageSchema = z
  .object({
    symptoms: z.array(z.enum(SYMPTOMS)).max(SYMPTOMS.length).default([]),
    notes: z.string().trim().max(1000).optional(),
    age: z.number().int().min(0).max(120).optional(),
  })
  .refine((body) => body.symptoms.length > 0 || Boolean(body.notes), "Provide at least one symptom or a note");

export const DaysQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});
