import type { Severity, Symptom, TriageRequest, TriageResult } from "../../../shared/types";

/**
 * Rule-based triage used when the LLM is unavailable (no key, timeout,
 * malformed output). Scores each condition by matched symptoms (weight 10),
 * keywords found in the free-text notes (weight 3), and a bonus when more
 * than one primary symptom matches.
 */
interface ConditionRule {
  condition: string;
  symptoms: Symptom[];
  keywords: string[];
  risk: Severity;
  summary: string;
  recommendations: string[];
  redFlags: string[];
}

const RULES: ConditionRule[] = [
  {
    condition: "Suspected dengue",
    symptoms: ["fever", "rash"],
    keywords: ["headache", "joint pain", "mosquito", "body ache", "platelet", "bleeding", "eye pain"],
    risk: "high",
    summary: "Fever with rash in an area with mosquito exposure is consistent with dengue and needs a blood test.",
    recommendations: [
      "Refer to the PHC for a dengue NS1/IgM test and platelet count",
      "Encourage oral fluids and ORS",
      "Use paracetamol for fever; avoid aspirin and ibuprofen",
      "Check the household for stagnant water and use mosquito nets",
    ],
    redFlags: ["Bleeding from gums or nose", "Persistent vomiting", "Severe abdominal pain", "Lethargy or restlessness"],
  },
  {
    condition: "Acute watery diarrhoea (possible cholera)",
    symptoms: ["diarrhea"],
    keywords: ["watery", "vomiting", "dehydration", "contaminated", "rice water", "many times"],
    risk: "high",
    summary: "Frequent watery stools can cause rapid dehydration; a contaminated water source should be suspected.",
    recommendations: [
      "Start ORS immediately and give zinc for children",
      "Assess dehydration and refer if moderate or severe",
      "Report the case so the village water source can be tested",
      "Advise boiling or chlorinating drinking water and handwashing with soap",
    ],
    redFlags: ["Sunken eyes or very dry mouth", "Unable to drink", "No urine for 6 hours", "Blood in stool"],
  },
  {
    condition: "Acute respiratory infection",
    symptoms: ["cough", "fever"],
    keywords: ["breathing", "chest", "cold", "pneumonia", "wheezing", "phlegm", "sore throat"],
    risk: "medium",
    summary: "Cough with fever suggests a respiratory infection; fast breathing may indicate pneumonia.",
    recommendations: [
      "Count the breathing rate and check oxygen saturation if a pulse oximeter is available",
      "Keep the patient hydrated and use paracetamol for fever",
      "Refer to the PHC if breathing is fast or difficult",
      "Advise masks and ventilation at home",
    ],
    redFlags: ["Fast or difficult breathing", "Chest indrawing in children", "Oxygen saturation below 94%", "Bluish lips"],
  },
  {
    condition: "Suspected malaria",
    symptoms: ["fever"],
    keywords: ["chills", "sweating", "cyclical", "mosquito", "shivering", "alternate days"],
    risk: "high",
    summary: "Fever with chills and sweating in a mosquito-prone area should be tested for malaria.",
    recommendations: [
      "Perform a malaria rapid diagnostic test (RDT)",
      "Refer RDT-positive patients for treatment as per national guidelines",
      "Ensure bed nets are used by the household",
    ],
    redFlags: ["Confusion or drowsiness", "Convulsions", "Yellow eyes", "Very dark urine"],
  },
  {
    condition: "Suspected measles",
    symptoms: ["rash", "fever"],
    keywords: ["spots", "red eyes", "running nose", "koplik", "unvaccinated", "child"],
    risk: "medium",
    summary: "Fever with a spreading rash, especially in unvaccinated children, should be reported as suspected measles.",
    recommendations: [
      "Check the vaccination status of the patient and household children",
      "Isolate the patient from other children",
      "Give vitamin A as per protocol and report to the surveillance officer",
    ],
    redFlags: ["Difficulty breathing", "Convulsions", "Severe dehydration", "Eye clouding"],
  },
  {
    condition: "Gastroenteritis",
    symptoms: ["diarrhea"],
    keywords: ["stomach", "nausea", "cramps", "food", "vomit", "outside food"],
    risk: "low",
    summary: "Diarrhoea with stomach cramps is commonly due to food- or water-borne infection and is usually self-limiting.",
    recommendations: [
      "Give ORS after every loose stool",
      "Continue feeding with light food",
      "Advise safe food handling and handwashing",
    ],
    redFlags: ["Signs of dehydration", "Blood in stool", "High fever", "Symptoms lasting more than 3 days"],
  },
  {
    condition: "Skin infection / scabies",
    symptoms: ["rash"],
    keywords: ["itching", "boils", "wound", "pus", "scratching", "night itch"],
    risk: "low",
    summary: "An itchy rash without fever is commonly a skin infection or scabies.",
    recommendations: [
      "Refer for prescribed topical treatment",
      "Treat all household members together for scabies",
      "Wash and sun-dry clothing and bedding",
    ],
    redFlags: ["Spreading redness", "Fever", "Pus-filled lesions"],
  },
  {
    condition: "Suspected tuberculosis",
    symptoms: ["cough"],
    keywords: ["weeks", "blood", "weight loss", "night sweats", "chronic", "tb", "sputum"],
    risk: "high",
    summary: "A cough for more than two weeks, especially with weight loss or night sweats, requires TB testing.",
    recommendations: [
      "Collect a sputum sample for testing (CBNAAT / microscopy)",
      "Refer to the nearest TB testing centre",
      "Screen household contacts",
    ],
    redFlags: ["Coughing blood", "Rapid weight loss", "Breathlessness"],
  },
];

const RISK_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

export function ruleBasedTriage(request: TriageRequest, fallbackReason?: string): TriageResult {
  const notes = (request.notes ?? "").toLowerCase();

  let best: ConditionRule | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const matched = rule.symptoms.filter((symptom) => request.symptoms.includes(symptom)).length;
    let score = matched * 10 + (matched > 1 ? 5 : 0);
    for (const keyword of rule.keywords) if (notes.includes(keyword)) score += 3;
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }

  const base: Omit<TriageResult, "source" | "fallbackReason"> = best
    ? {
        likelyCondition: best.condition,
        riskLevel: best.risk,
        summary: best.summary,
        recommendations: [...best.recommendations],
        redFlags: [...best.redFlags],
        referToPHC: best.risk === "high",
      }
    : {
        likelyCondition: "Undifferentiated mild illness",
        riskLevel: "low",
        summary: "The reported details do not match a specific pattern. Observe and record any new symptoms.",
        recommendations: ["Record temperature and symptoms daily", "Revisit within 48 hours", "Refer if any red flag appears"],
        redFlags: ["High fever", "Difficulty breathing", "Unable to drink", "Drowsiness"],
        referToPHC: false,
      };

  // Young children and older adults get one level of caution added.
  if (request.age !== undefined && (request.age < 5 || request.age >= 65) && RISK_RANK[base.riskLevel] < RISK_RANK.medium) {
    base.riskLevel = "medium";
    base.recommendations.push("Patient is in a vulnerable age group — follow up within 24 hours");
  }

  return { ...base, source: "rules", ...(fallbackReason ? { fallbackReason } : {}) };
}
