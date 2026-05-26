// In-memory backend simulation + localStorage offline queue

export type Symptom = "fever" | "cough" | "diarrhea" | "rash";
export type Severity = "low" | "medium" | "high";
export type AlertStatus = "active" | "in-progress" | "resolved";
export type Role = "asha" | "district" | "state";
export type Gender = "male" | "female" | "other";

export interface PatientReport {
  id: string;
  patientName: string;
  age: number;
  gender: Gender;
  village: string;
  symptom: Symptom;
  timestamp: string;
  synced: boolean;
}

export interface OutbreakAlert {
  id: string;
  village: string;
  caseCount: number;
  severity: Severity;
  status: AlertStatus;
  timestamp: string;
  symptom: Symptom;
}

export interface DeploymentBrief {
  alertId: string;
  destinationVillage: string;
  outbreakSummary: string;
  outbreakDescription: string;
  medicines: string[];
  medicalTools: string[];
  otherRequirements: string[];
  fieldInstructions: string[];
  assemblyPoint: string;
  transportPlan: string;
  responseWindow: string;
  reportingInstructions: string;
  contactPoint: string;
  updatedAt: string;
}

const VILLAGES = ["Rampur", "Govindpur", "Lakshmipur", "Chandanpur", "Narayanpur", "Sunderpur", "Devpur", "Kamalpur"];

const DEPLOYMENT_TEMPLATES: Record<
  Symptom,
  Omit<
    DeploymentBrief,
    | "alertId"
    | "destinationVillage"
    | "assemblyPoint"
    | "transportPlan"
    | "responseWindow"
    | "contactPoint"
    | "updatedAt"
  >
> = {
  fever: {
    outbreakSummary: "Acute febrile illness cluster",
    outbreakDescription:
      "Multiple fever cases have been reported from the village. Screen for dehydration, mosquito-borne illness, and patients with persistent high temperature or weakness.",
    medicines: ["Paracetamol tablets", "ORS sachets", "IV fluids", "Antipyretic syrup for children"],
    medicalTools: ["Digital thermometers", "Blood pressure monitor", "Pulse oximeter", "Rapid fever screening forms"],
    otherRequirements: ["Mosquito control IEC material", "Safe drinking water advisory leaflets", "Referral slips for severe cases"],
    fieldInstructions: [
      "Screen all symptomatic households in the affected cluster",
      "Refer patients with persistent high fever or altered sensorium",
      "Check stagnant water sites and note mosquito breeding risk",
    ],
    reportingInstructions:
      "Send fever line list, severe case count, and water or vector risk observations in the first field update.",
  },
  diarrhea: {
    outbreakSummary: "Acute diarrheal disease outbreak",
    outbreakDescription:
      "A rising number of diarrhea cases suggests a possible water-borne outbreak. Prioritize dehydration assessment, safe water messaging, and identification of contaminated sources.",
    medicines: ["ORS sachets", "Zinc tablets", "IV fluids", "Electrolyte replacement supplies"],
    medicalTools: ["Dehydration assessment charts", "Water sample containers", "BP apparatus", "Portable weighing scale"],
    otherRequirements: ["Water chlorination support", "Soap and hand hygiene material", "Temporary rehydration corner setup"],
    fieldInstructions: [
      "Assess dehydration severity and start rehydration immediately",
      "Inspect common drinking water points and storage containers",
      "Escalate children, elderly patients, and pregnant women with severe dehydration",
    ],
    reportingInstructions:
      "Share hydration status summary, suspected water source, and number of patients referred for inpatient care.",
  },
  cough: {
    outbreakSummary: "Respiratory illness cluster",
    outbreakDescription:
      "Respiratory symptoms are clustering in the village. Triage patients with breathlessness quickly and assess whether any shared exposure or household spread is occurring.",
    medicines: ["Paracetamol tablets", "Cough relief syrup", "Antihistamine tablets", "Nebulization backup stock"],
    medicalTools: ["Pulse oximeter", "Stethoscope", "Thermometer", "Respiratory screening register"],
    otherRequirements: ["Masks for patients and caregivers", "Ventilation awareness pamphlets", "Referral transport standby"],
    fieldInstructions: [
      "Separate symptomatic patients where possible during camp assessment",
      "Refer low oxygen saturation or severe breathlessness immediately",
      "Document household clusters and vulnerable patients",
    ],
    reportingInstructions:
      "Report symptomatic contacts, respiratory distress cases, and oxygen support needs in the first dispatch update.",
  },
  rash: {
    outbreakSummary: "Rash and fever surveillance response",
    outbreakDescription:
      "Rash cases need close observation to identify viral spread, allergic exposure, or rapidly worsening symptoms. Focus on children and patients with associated fever.",
    medicines: ["Antihistamine tablets", "Calamine lotion", "Paracetamol tablets", "Topical soothing cream"],
    medicalTools: ["Skin examination torch", "Thermometer", "Sample collection swabs", "Patient documentation sheets"],
    otherRequirements: ["Isolation advice leaflets", "Child screening support", "Community notification through village leaders"],
    fieldInstructions: [
      "Identify fever with rash cases and isolate where required",
      "Check for similar symptoms in nearby households and schools",
      "Document photographs or notes for unusual skin presentations",
    ],
    reportingInstructions:
      "Include age distribution, rash spread pattern, and any school-based clustering in the field report.",
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

// In-memory backend DB
let syncedReports: PatientReport[] = [];
let alerts: OutbreakAlert[] = [];
let deploymentBriefs: Record<string, DeploymentBrief> = {};

function cloneDeploymentBrief(brief: DeploymentBrief): DeploymentBrief {
  return {
    ...brief,
    medicines: [...brief.medicines],
    medicalTools: [...brief.medicalTools],
    otherRequirements: [...brief.otherRequirements],
    fieldInstructions: [...brief.fieldInstructions],
  };
}

function createDefaultDeploymentBrief(alert: OutbreakAlert): DeploymentBrief {
  const template = DEPLOYMENT_TEMPLATES[alert.symptom];

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
    fieldInstructions: [
      ...template.fieldInstructions,
      `Cover the highest-risk hamlets of ${alert.village} in the first response round`,
    ],
    assemblyPoint: `${alert.village} Primary Health Sub-Centre`,
    transportPlan: TRANSPORT_PLANS[alert.severity],
    responseWindow: RESPONSE_WINDOWS[alert.severity],
    reportingInstructions: template.reportingInstructions,
    contactPoint: CONTACT_POINTS[alert.severity],
    updatedAt: new Date().toISOString(),
  };
}

// Seed some initial data for demo
function seedData() {
  const now = Date.now();
  const symptoms: Symptom[] = ["fever", "fever", "fever", "diarrhea", "cough", "fever", "diarrhea", "diarrhea", "rash", "fever"];
  const villages = ["Rampur", "Rampur", "Rampur", "Govindpur", "Lakshmipur", "Rampur", "Govindpur", "Govindpur", "Chandanpur", "Rampur"];

  const names = ["Rani Devi", "Suresh Kumar", "Meena Bai", "Raju Prasad", "Lakshmi Devi", "Mohan Lal", "Sunita Kumari", "Dinesh Yadav", "Geeta Devi", "Anil Sharma"];
  const ages = [32, 45, 28, 55, 19, 67, 40, 22, 38, 50];
  const genders: Gender[] = ["female", "male", "female", "male", "female", "male", "female", "male", "female", "male"];

  syncedReports = symptoms.map((symptom, index) => ({
    id: `seed-${index}`,
    patientName: names[index],
    age: ages[index],
    gender: genders[index],
    village: villages[index],
    symptom,
    timestamp: new Date(now - (10 - index) * 3600000).toISOString(),
    synced: true,
  }));

  runDetection();
}

seedData();

// LOCAL STORAGE for offline queue
const QUEUE_KEY = "rhin_offline_queue";

export function getOfflineQueue(): PatientReport[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function addToOfflineQueue(report: Omit<PatientReport, "id" | "synced" | "timestamp">): PatientReport {
  const queue = getOfflineQueue();
  const newReport: PatientReport = {
    ...report,
    id: `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    synced: false,
  };
  queue.push(newReport);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return newReport;
}

export function clearOfflineQueue() {
  localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
}

// BACKEND API simulation
export function syncReports(): { success: boolean; count: number; aiMessage: string } {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: true, count: 0, aiMessage: "" };

  syncedReports = [...syncedReports, ...queue.map((report) => ({ ...report, synced: true }))];
  clearOfflineQueue();
  runDetection();

  const aiMessage = generateAIGuidance();
  return { success: true, count: queue.length, aiMessage };
}

function generateAIGuidance(): string {
  const villageCounts: Record<string, Record<string, number>> = {};

  syncedReports.forEach((report) => {
    if (!villageCounts[report.village]) villageCounts[report.village] = {};
    villageCounts[report.village][report.symptom] = (villageCounts[report.village][report.symptom] || 0) + 1;
  });

  let maxVillage = "";
  let maxSymptom = "";
  let maxCount = 0;

  Object.entries(villageCounts).forEach(([village, symptoms]) => {
    Object.entries(symptoms).forEach(([symptom, count]) => {
      if (count > maxCount) {
        maxVillage = village;
        maxSymptom = symptom;
        maxCount = count;
      }
    });
  });

  if (maxCount >= 3) {
    return `Increasing ${maxSymptom} cases detected in ${maxVillage} (${maxCount} cases). Monitor village closely.`;
  }

  return "No unusual patterns detected. Continue routine monitoring.";
}

// OUTBREAK DETECTION
function runDetection() {
  const villageCounts: Record<string, Record<string, number>> = {};

  syncedReports.forEach((report) => {
    if (!villageCounts[report.village]) villageCounts[report.village] = {};
    villageCounts[report.village][report.symptom] = (villageCounts[report.village][report.symptom] || 0) + 1;
  });

  Object.entries(villageCounts).forEach(([village, symptoms]) => {
    Object.entries(symptoms).forEach(([symptom, count]) => {
      if ((symptom === "fever" || symptom === "diarrhea") && count >= 5) {
        const existingAlert = alerts.find(
          (alert) => alert.village === village && alert.symptom === (symptom as Symptom) && alert.status !== "resolved",
        );

        if (!existingAlert) {
          const severity: Severity = count >= 10 ? "high" : count >= 7 ? "medium" : "low";
          alerts.push({
            id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            village,
            caseCount: count,
            severity,
            status: "active",
            timestamp: new Date().toISOString(),
            symptom: symptom as Symptom,
          });
        } else {
          existingAlert.caseCount = count;
          existingAlert.severity = count >= 10 ? "high" : count >= 7 ? "medium" : "low";
        }
      }
    });
  });
}

export function getAlerts(): OutbreakAlert[] {
  return [...alerts];
}

export function getAllReports(): PatientReport[] {
  return [...syncedReports];
}

export function getDeploymentBrief(alertId: string): DeploymentBrief | null {
  const alert = alerts.find((item) => item.id === alertId);
  if (!alert) return null;

  if (!deploymentBriefs[alertId]) {
    deploymentBriefs[alertId] = createDefaultDeploymentBrief(alert);
  }

  return cloneDeploymentBrief(deploymentBriefs[alertId]);
}

export function updateDeploymentBrief(
  alertId: string,
  updates: Partial<Omit<DeploymentBrief, "alertId" | "updatedAt">>,
): DeploymentBrief | null {
  const currentBrief = getDeploymentBrief(alertId);
  if (!currentBrief) return null;

  const nextBrief: DeploymentBrief = {
    ...currentBrief,
    ...updates,
    medicines: updates.medicines ? [...updates.medicines] : currentBrief.medicines,
    medicalTools: updates.medicalTools ? [...updates.medicalTools] : currentBrief.medicalTools,
    otherRequirements: updates.otherRequirements ? [...updates.otherRequirements] : currentBrief.otherRequirements,
    fieldInstructions: updates.fieldInstructions ? [...updates.fieldInstructions] : currentBrief.fieldInstructions,
    updatedAt: new Date().toISOString(),
  };

  deploymentBriefs[alertId] = nextBrief;
  return cloneDeploymentBrief(nextBrief);
}

export function deployTeam(alertId: string) {
  const alert = alerts.find((item) => item.id === alertId);
  if (alert) {
    getDeploymentBrief(alertId);
    alert.status = "in-progress";
  }
}

export function resolveAlert(alertId: string) {
  const alert = alerts.find((item) => item.id === alertId);
  if (alert) alert.status = "resolved";
}

// Create alert from AI disease analysis when severity is severe/moderate
export function createAlertFromAI(
  village: string,
  disease: string,
  severity: "mild" | "moderate" | "severe",
  symptom: Symptom,
): OutbreakAlert | null {
  if (severity === "mild") return null;

  const existingAlert = alerts.find((alert) => alert.village === village && alert.symptom === symptom && alert.status !== "resolved");
  if (existingAlert) {
    existingAlert.caseCount += 1;
    if (severity === "severe") existingAlert.severity = "high";
    else if (severity === "moderate" && existingAlert.severity === "low") existingAlert.severity = "medium";
    return existingAlert;
  }

  const newAlert: OutbreakAlert = {
    id: `ai-alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    village,
    caseCount: 1,
    severity: severity === "severe" ? "high" : "medium",
    status: "active",
    timestamp: new Date().toISOString(),
    symptom,
  };

  alerts.push(newAlert);
  const defaultBrief = createDefaultDeploymentBrief(newAlert);
  deploymentBriefs[newAlert.id] = {
    ...defaultBrief,
    outbreakSummary: disease || defaultBrief.outbreakSummary,
  };

  return newAlert;
}

export function getVillages(): string[] {
  return [...VILLAGES];
}

export function getStats() {
  const totalReports = syncedReports.length;
  const activeAlerts = alerts.filter((alert) => alert.status === "active").length;
  const inProgressAlerts = alerts.filter((alert) => alert.status === "in-progress").length;
  const resolvedAlerts = alerts.filter((alert) => alert.status === "resolved").length;
  const monitoredVillages = new Set(syncedReports.map((report) => report.village)).size;

  return { totalReports, activeAlerts, inProgressAlerts, resolvedAlerts, monitoredVillages };
}

// Trend data for charts
export function getTrendData() {
  const days = 7;
  const data = [];
  const now = Date.now();

  for (let index = days - 1; index >= 0; index -= 1) {
    const dayStart = now - index * 86400000;
    const label = new Date(dayStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const dayReports = syncedReports.filter((report) => {
      const timestamp = new Date(report.timestamp).getTime();
      return timestamp >= dayStart - 86400000 && timestamp < dayStart;
    });

    data.push({
      date: label,
      fever: dayReports.filter((report) => report.symptom === "fever").length + Math.floor(Math.random() * 3),
      diarrhea: dayReports.filter((report) => report.symptom === "diarrhea").length + Math.floor(Math.random() * 2),
      cough: dayReports.filter((report) => report.symptom === "cough").length + Math.floor(Math.random() * 2),
      rash: dayReports.filter((report) => report.symptom === "rash").length + Math.floor(Math.random() * 1),
    });
  }

  return data;
}

export function getTopAffectedVillages() {
  const counts: Record<string, number> = {};

  syncedReports.forEach((report) => {
    counts[report.village] = (counts[report.village] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([village, cases]) => ({ village, cases }));
}
