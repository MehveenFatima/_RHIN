import type { DeploymentBrief, OutbreakAlert, Severity, Symptom } from "../../../shared/types";

type BriefTemplate = Pick<
  DeploymentBrief,
  | "outbreakSummary"
  | "outbreakDescription"
  | "medicines"
  | "medicalTools"
  | "otherRequirements"
  | "fieldInstructions"
  | "reportingInstructions"
>;

const TEMPLATES: Record<Symptom, BriefTemplate> = {
  fever: {
    outbreakSummary: "Acute febrile illness cluster",
    outbreakDescription:
      "Multiple fever cases have been reported from the village. Screen for dehydration, mosquito-borne illness, and patients with persistent high temperature or weakness.",
    medicines: ["Paracetamol tablets", "ORS sachets", "IV fluids", "Antipyretic syrup for children"],
    medicalTools: ["Digital thermometers", "Blood pressure monitor", "Pulse oximeter", "Malaria/dengue rapid diagnostic kits"],
    otherRequirements: ["Mosquito control IEC material", "Safe drinking water advisory leaflets", "Referral slips for severe cases"],
    fieldInstructions: [
      "Screen all symptomatic households in the affected cluster",
      "Refer patients with persistent high fever, bleeding or altered sensorium",
      "Check stagnant water sites and note mosquito breeding risk",
    ],
    reportingInstructions:
      "Send the fever line list, severe case count, and water or vector risk observations in the first field update.",
  },
  diarrhea: {
    outbreakSummary: "Acute diarrhoeal disease cluster",
    outbreakDescription:
      "A rising number of diarrhoea cases suggests a possible water-borne outbreak. Prioritise dehydration assessment, safe-water messaging, and identification of contaminated sources.",
    medicines: ["ORS sachets", "Zinc tablets", "IV fluids (Ringer's lactate)", "Water purification tablets"],
    medicalTools: ["Dehydration assessment charts", "Water sample containers", "BP apparatus", "Portable weighing scale"],
    otherRequirements: ["Water chlorination support", "Soap and hand-hygiene material", "Temporary ORS corner setup"],
    fieldInstructions: [
      "Assess dehydration severity and start rehydration immediately",
      "Inspect common drinking water points and storage containers",
      "Escalate children, elderly patients, and pregnant women with severe dehydration",
    ],
    reportingInstructions:
      "Share a hydration status summary, the suspected water source, and the number of patients referred for inpatient care.",
  },
  cough: {
    outbreakSummary: "Respiratory illness cluster",
    outbreakDescription:
      "Respiratory symptoms are clustering in the village. Triage patients with breathlessness quickly and assess whether any shared exposure or household spread is occurring.",
    medicines: ["Paracetamol tablets", "Cough relief syrup", "Salbutamol inhaler / nebulisation stock", "Oxygen cylinder (standby)"],
    medicalTools: ["Pulse oximeter", "Stethoscope", "Thermometer", "Respiratory screening register"],
    otherRequirements: ["Masks for patients and caregivers", "Ventilation awareness pamphlets", "Referral transport on standby"],
    fieldInstructions: [
      "Separate symptomatic patients where possible during camp assessment",
      "Refer low oxygen saturation or severe breathlessness immediately",
      "Collect sputum from anyone coughing for more than two weeks (TB screening)",
    ],
    reportingInstructions:
      "Report symptomatic contacts, respiratory distress cases, and oxygen support needs in the first dispatch update.",
  },
  rash: {
    outbreakSummary: "Fever-with-rash surveillance response",
    outbreakDescription:
      "Rash cases need close observation to identify viral spread (such as measles), allergic exposure, or rapidly worsening symptoms. Focus on children and patients with associated fever.",
    medicines: ["Vitamin A supplements", "Paracetamol tablets", "Calamine lotion", "Antihistamine tablets"],
    medicalTools: ["Skin examination torch", "Thermometer", "Sample collection swabs and vials", "Patient documentation sheets"],
    otherRequirements: ["Isolation advice leaflets", "Vaccination status cards", "Community notification through village leaders"],
    fieldInstructions: [
      "Identify fever-with-rash cases and isolate where required",
      "Check vaccination status of children in affected and neighbouring households",
      "Check for similar symptoms in nearby households and schools",
    ],
    reportingInstructions:
      "Include age distribution, rash spread pattern, vaccination status and any school-based clustering in the field report.",
  },
};

const RESPONSE_WINDOWS: Record<Severity, string> = {
  high: "Reach within 2 hours",
  medium: "Reach within 4 hours",
  low: "Reach within 6 hours",
};

const TRANSPORT_PLANS: Record<Severity, string> = {
  high: "Dispatch ambulance with hydration supplies and rapid response kit.",
  medium: "Dispatch district medical van with outbreak response stock.",
  low: "Dispatch PHC jeep with nursing support and surveillance forms.",
};

const CONTACT_POINTS: Record<Severity, string> = {
  high: "District surveillance control room and block medical officer",
  medium: "Block medical officer and village health sub-centre",
  low: "Primary health centre duty officer",
};

/** Build the pre-filled brief a district officer reviews before dispatching a team. */
export function createDeploymentBrief(alert: OutbreakAlert, now: Date = new Date()): DeploymentBrief {
  const template = TEMPLATES[alert.symptom];
  return {
    alertId: alert.id,
    destinationVillage: alert.village,
    outbreakSummary: template.outbreakSummary,
    outbreakDescription: `${template.outbreakDescription} Currently ${alert.caseCount} suspected ${alert.symptom} cases are linked to ${alert.village}.`,
    medicines: [...template.medicines],
    medicalTools: [...template.medicalTools],
    otherRequirements: [
      ...template.otherRequirements,
      "Carry PPE, drinking water, and referral documentation",
      `Coordinate with ${alert.village} local leadership before door-to-door screening`,
    ],
    fieldInstructions: [...template.fieldInstructions, `Cover the highest-risk hamlets of ${alert.village} in the first response round`],
    assemblyPoint: `${alert.village} Health Sub-Centre`,
    transportPlan: TRANSPORT_PLANS[alert.severity],
    responseWindow: RESPONSE_WINDOWS[alert.severity],
    reportingInstructions: template.reportingInstructions,
    contactPoint: CONTACT_POINTS[alert.severity],
    updatedAt: now.toISOString(),
  };
}
