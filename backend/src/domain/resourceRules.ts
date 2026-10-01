import type { PlanAction, PlanItem, StaffingPlan, Symptom } from "../../../shared/types";

/**
 * Staffing is computed deterministically rather than asked of the model:
 * 1 doctor per 50 cases, 1 nurse per 20, 1 field worker per 10 (minimum one each).
 */
export function computeStaffing(caseCount: number): StaffingPlan {
  const doctors = Math.max(1, Math.ceil(caseCount / 50));
  const nurses = Math.max(1, Math.ceil(caseCount / 20));
  const fieldWorkers = Math.max(1, Math.ceil(caseCount / 10));
  return { doctors, nurses, fieldWorkers, total: doctors + nurses + fieldWorkers };
}

export interface PlanBody {
  condition: string;
  durationDays: number;
  medicines: PlanItem[];
  equipment: PlanItem[];
  actions: PlanAction[];
  notes: string;
}

const atLeast = (value: number) => Math.max(1, Math.ceil(value));

/** Template plans used when the LLM is unavailable. Quantities scale with case count. */
export function ruleBasedPlan(symptom: Symptom, caseCount: number): PlanBody {
  const n = caseCount;
  switch (symptom) {
    case "diarrhea":
      return {
        condition: "Acute diarrhoeal disease",
        durationDays: 7,
        medicines: [
          { name: "ORS sachets", quantity: atLeast(n * 15), unit: "sachets", purpose: "Rehydration" },
          { name: "Zinc tablets (20 mg)", quantity: atLeast(n * 14), unit: "tablets", purpose: "Recovery support for children" },
          { name: "IV fluids (Ringer's lactate)", quantity: atLeast(n * 0.2 * 2), unit: "litres", purpose: "Severe dehydration" },
          { name: "Water purification tablets", quantity: atLeast(n * 30), unit: "tablets", purpose: "Household water safety" },
        ],
        equipment: [
          { name: "Water sample containers", quantity: 10, unit: "units", purpose: "Source testing" },
          { name: "Chlorine for wells", quantity: atLeast(n / 10), unit: "kg", purpose: "Disinfecting water sources" },
          { name: "Hygiene kits (soap, bucket with lid)", quantity: atLeast(n), unit: "kits", purpose: "Household hygiene" },
        ],
        actions: [
          { day: 1, action: "Set up an ORS corner and assess dehydration in all cases", responsible: "Nurses" },
          { day: 1, action: "Collect water samples from common sources", responsible: "Field workers" },
          { day: 2, action: "Chlorinate wells and storage tanks", responsible: "Field workers" },
          { day: 3, action: "House-to-house search for new cases", responsible: "Field workers" },
          { day: 7, action: "Review case trend and close response if no new cases", responsible: "Doctor" },
        ],
        notes: "Most cases recover with ORS and zinc. Antibiotics only on clinical assessment (e.g. suspected cholera or dysentery).",
      };
    case "cough":
      return {
        condition: "Acute respiratory infection cluster",
        durationDays: 10,
        medicines: [
          { name: "Paracetamol 500 mg", quantity: atLeast(n * 15), unit: "tablets", purpose: "Fever and pain" },
          { name: "Cough syrup", quantity: atLeast(n), unit: "bottles", purpose: "Symptomatic relief" },
          { name: "Salbutamol (inhaler / nebuliser respules)", quantity: atLeast(n / 5), unit: "units", purpose: "Wheezing" },
        ],
        equipment: [
          { name: "Pulse oximeters", quantity: atLeast(n / 30), unit: "units", purpose: "Oxygen saturation screening" },
          { name: "Masks", quantity: atLeast(n * 5), unit: "pieces", purpose: "Infection control" },
          { name: "Sputum collection kits", quantity: atLeast(n / 5), unit: "kits", purpose: "TB screening for chronic cough" },
        ],
        actions: [
          { day: 1, action: "Screen all cases with pulse oximetry; refer SpO2 below 94%", responsible: "Nurses" },
          { day: 1, action: "Distribute masks to cases and caregivers", responsible: "Field workers" },
          { day: 3, action: "Follow up high-risk patients (children under 5, elderly)", responsible: "Nurses" },
          { day: 5, action: "Collect sputum from coughs lasting over two weeks", responsible: "Field workers" },
          { day: 10, action: "Review trend and close response", responsible: "Doctor" },
        ],
        notes: "Antibiotics only on clinical assessment. Prioritise children under 5 and elderly patients for follow-up.",
      };
    case "rash":
      return {
        condition: "Fever with rash (suspected measles)",
        durationDays: 14,
        medicines: [
          { name: "Vitamin A", quantity: atLeast(n * 2), unit: "doses", purpose: "Reduce measles complications" },
          { name: "Paracetamol 500 mg", quantity: atLeast(n * 10), unit: "tablets", purpose: "Fever" },
          { name: "ORS sachets", quantity: atLeast(n * 5), unit: "sachets", purpose: "Hydration" },
        ],
        equipment: [
          { name: "Serum sample collection kits", quantity: Math.min(5, atLeast(n)), unit: "kits", purpose: "Laboratory confirmation" },
          { name: "Cold box with vaccine carriers", quantity: 2, unit: "units", purpose: "Outbreak-response vaccination" },
          { name: "Thermometers", quantity: atLeast(n / 20), unit: "units", purpose: "Fever monitoring" },
        ],
        actions: [
          { day: 1, action: "Collect samples from the first cases for laboratory confirmation", responsible: "Doctor" },
          { day: 1, action: "Line-list cases with age and vaccination status", responsible: "Field workers" },
          { day: 2, action: "Isolate cases and give vitamin A", responsible: "Nurses" },
          { day: 3, action: "Vaccinate unvaccinated children in the area as directed by the district", responsible: "Nurses" },
          { day: 14, action: "Close response after two incubation periods without new cases", responsible: "Doctor" },
        ],
        notes: "Confirm with laboratory testing before declaring a measles outbreak. Watch for pneumonia and diarrhoea complications.",
      };
    case "fever":
    default:
      return {
        condition: "Acute febrile illness (vector-borne suspected)",
        durationDays: 14,
        medicines: [
          { name: "Paracetamol 500 mg", quantity: atLeast(n * 20), unit: "tablets", purpose: "Fever" },
          { name: "ORS sachets", quantity: atLeast(n * 10), unit: "sachets", purpose: "Hydration" },
          { name: "IV fluids (normal saline)", quantity: atLeast(n * 0.2 * 2), unit: "litres", purpose: "Severe cases" },
        ],
        equipment: [
          { name: "Malaria rapid diagnostic tests", quantity: atLeast(n * 2), unit: "tests", purpose: "Malaria screening" },
          { name: "Dengue NS1 rapid tests", quantity: atLeast(n), unit: "tests", purpose: "Dengue screening" },
          { name: "Insecticide-treated bed nets", quantity: atLeast(n), unit: "units", purpose: "Vector protection" },
          { name: "Larvicide", quantity: atLeast(n / 10), unit: "litres", purpose: "Source reduction" },
        ],
        actions: [
          { day: 1, action: "Test all fever cases with malaria and dengue rapid tests", responsible: "Nurses" },
          { day: 1, action: "Map and eliminate stagnant water around affected homes", responsible: "Field workers" },
          { day: 2, action: "Distribute bed nets to affected households", responsible: "Field workers" },
          { day: 4, action: "Follow up positive cases and monitor warning signs", responsible: "Doctor" },
          { day: 14, action: "Review trend and close response", responsible: "Doctor" },
        ],
        notes: "Avoid NSAIDs until dengue is ruled out. Refer any patient with bleeding, persistent vomiting or drowsiness.",
      };
  }
}
