const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = "your_groq_api_key_here";

// =========================
// 🧠 IN-MEMORY DATA
// =========================
let reports = [];
let alerts = [];
let resourcePlans = [];
let deploymentTeams = [];

// =========================
// 🧪 TEST ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("Backend running");
});

// =========================
// 🧾 1. SYNC REPORTS (ASHA)
// =========================
app.post("/api/v1/sync/upload", (req, res) => {
  const { reports: newReports } = req.body;

  if (!newReports || newReports.length === 0) {
    return res.status(400).json({ error: "No reports provided" });
  }

  reports.push(...newReports);

  if (newReports.length >= 3) {
    alerts.push({
      id: Date.now(),
      village: newReports[0].village,
      disease: newReports[0].symptom,
      cases: newReports.length,
      status: "Active",
      severity: "high"
    });
  }

  res.json({ success: true });
});

// =========================
// 🚨 2. GET ALERTS
// =========================
app.get("/api/v1/alerts", (req, res) => {
  res.json(alerts);
});

// =========================
// 🚑 3. DEPLOY TEAM
// =========================
app.post("/api/v1/intervention/deploy-local", (req, res) => {
  const { alert_id } = req.body;

  alerts = alerts.map(a =>
    a.id === alert_id ? { ...a, status: "In Progress" } : a
  );

  res.json({ message: "Team deployed" });
});

// =========================
// ⬆️ 4. ESCALATE ALERT
// =========================
app.post("/api/v1/alerts/escalate", (req, res) => {
  const { alert_id } = req.body;

  alerts = alerts.map(a =>
    a.id === alert_id ? { ...a, status: "Escalated" } : a
  );

  res.json({ message: "Alert escalated" });
});

// =========================
// ✔️ 5. RESOLVE ALERT
// =========================
app.post("/api/v1/alerts/update-status", (req, res) => {
  const { alert_id } = req.body;

  alerts = alerts.map(a =>
    a.id === alert_id ? { ...a, status: "Resolved" } : a
  );

  res.json({ message: "Alert resolved" });
});

// =========================
// 🤖 6. AI ANALYSIS (GROQ + FALLBACK)
// =========================
app.post("/api/v1/ai/analyze", async (req, res) => {
  const { symptoms, notes } = req.body;

  console.log("AI API HIT:", symptoms);

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: `
Patient symptoms: ${symptoms.join(", ")}
Additional notes: ${notes}

Give:
1. Disease
2. Risk level
3. Advice
`
          }
        ],
        max_tokens: 150
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiText = response.data?.choices?.[0]?.message?.content || "AI response received";

    console.log("✅ AI Response:", aiText);
    res.json({ result: aiText });

  } catch (error) {
    console.error("❌ AI ERROR:", error.response?.data || error.message);

    let result = "";

    if (symptoms.includes("fever") && symptoms.includes("rash")) {
      result = "Dengue suspected. High risk. Refer immediately.";
    } else if (symptoms.includes("fever") && symptoms.includes("cough")) {
      result = "Respiratory infection suspected. Medium risk.";
    } else if (symptoms.includes("diarrhea")) {
      result = "Gastro infection suspected. Give ORS and monitor.";
    } else {
      result = "Mild symptoms. Follow standard protocol.";
    }

    res.json({ result });
  }
});

// =========================
// 📦 7. AI-POWERED RESOURCE PLANNING
// =========================

// Generate AI resource plan for an outbreak
app.post("/api/v1/resources/ai-plan", async (req, res) => {
  const { alertId, disease, affectedVillage, caseCount } = req.body;

  if (!disease || !affectedVillage || !caseCount) {
    return res.status(400).json({ error: "Missing disease, village, or case count" });
  }

  console.log(`🤖 Generating AI resource plan for ${disease} in ${affectedVillage} (${caseCount} cases)`);

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: `
You are a public health expert. An outbreak of ${disease} has occurred in ${affectedVillage} with ${caseCount} confirmed cases.

Provide a structured resource and deployment plan in JSON format ONLY (no markdown, no explanation):

{
  "disease": "${disease}",
  "severity": "mild|moderate|severe",
  "estimatedDuration": "number of days",
  "medicines": [
    {
      "name": "medicine name",
      "quantity": number,
      "unit": "tablets/vials/ml",
      "purpose": "what it treats",
      "dosage": "recommended dosage"
    }
  ],
  "vaccines": [
    {
      "name": "vaccine name",
      "quantity": number,
      "unit": "doses",
      "target": "who should receive (e.g., 5-15 years, all ages)",
      "purpose": "prevention/immunity"
    }
  ],
  "tools": [
    {
      "name": "tool/equipment name",
      "quantity": number,
      "unit": "units",
      "purpose": "why needed"
    }
  ],
  "deploymentTeams": {
    "doctors": number,
    "nurses": number,
    "fieldWorkers": number,
    "totalTeamSize": number,
    "rationale": "explanation of team composition"
  },
  "actionPlan": [
    {
      "day": number,
      "action": "specific action",
      "responsible": "team role",
      "expectedOutcome": "what should be achieved"
    }
  ],
  "estimatedCost": number,
  "notes": "any additional recommendations"
}

Be realistic. Base recommendations on: 1 doctor per 50 cases, 1 nurse per 20 cases, 1 field worker per 10 cases. Adjust medicine quantities for 10-14 days of treatment. Include prevention measures.
`
          }
        ],
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let aiResponse = response.data?.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const plan = JSON.parse(jsonMatch[0]);

    // Store the plan
    const storedPlan = {
      id: Date.now(),
      alertId,
      ...plan,
      createdAt: new Date().toISOString(),
      status: "pending" // pending, approved, deployed, completed
    };

    resourcePlans.push(storedPlan);

    console.log("✅ AI Resource Plan Generated:", storedPlan);
    res.json(storedPlan);

  } catch (error) {
    console.error("❌ AI Planning Error:", error.message);

    // Fallback plan based on disease
    const fallbackPlans = {
      dengue: {
        disease: "Dengue",
        severity: "moderate",
        estimatedDuration: 14,
        medicines: [
          { name: "Paracetamol 500mg", quantity: caseCount * 30, unit: "tablets", purpose: "Fever reduction", dosage: "500mg every 6 hours" },
          { name: "Oral Rehydration Salts (ORS)", quantity: caseCount * 20, unit: "sachets", purpose: "Rehydration", dosage: "As needed" },
          { name: "Multivitamins", quantity: caseCount * 14, unit: "tablets", purpose: "Recovery support", dosage: "1 tablet daily" }
        ],
        vaccines: [],
        tools: [
          { name: "Thermometer (Digital)", quantity: Math.ceil(caseCount / 50), unit: "units", purpose: "Temperature monitoring" },
          { name: "Mosquito Net", quantity: caseCount * 1.5, unit: "units", purpose: "Prevention" },
          { name: "Insecticide Spray", quantity: Math.ceil(caseCount / 100), unit: "cans", purpose: "Vector control" }
        ],
        deploymentTeams: {
          doctors: Math.ceil(caseCount / 50),
          nurses: Math.ceil(caseCount / 20),
          fieldWorkers: Math.ceil(caseCount / 10),
          totalTeamSize: Math.ceil(caseCount / 50) + Math.ceil(caseCount / 20) + Math.ceil(caseCount / 10),
          rationale: "Standard outbreak response team composition"
        },
        actionPlan: [
          { day: 1, action: "Set up isolation ward", responsible: "doctors", expectedOutcome: "All severe cases isolated" },
          { day: 1, action: "Begin contact tracing", responsible: "fieldWorkers", expectedOutcome: "Identify 70% of contacts" },
          { day: 2, action: "Start treatment", responsible: "nurses", expectedOutcome: "All cases under medication" },
          { day: 3, action: "Begin mosquito control", responsible: "fieldWorkers", expectedOutcome: "50% vector reduction" },
          { day: 7, action: "Monitor recovery", responsible: "nurses", expectedOutcome: "Track recovery metrics" },
          { day: 14, action: "Assess outbreak control", responsible: "doctors", expectedOutcome: "No new cases for 7 days" }
        ],
        estimatedCost: (caseCount * 200) + (Math.ceil(caseCount / 50) * 5000),
        notes: "Focus on vector control and symptomatic treatment. Monitor for severe cases requiring hospitalization."
      },
      respiratory: {
        disease: "Respiratory Infection",
        severity: "moderate",
        estimatedDuration: 10,
        medicines: [
          { name: "Cough Syrup (Expectorant)", quantity: caseCount * 1, unit: "bottles", purpose: "Cough suppression", dosage: "5ml every 8 hours" },
          { name: "Antibiotic (Amoxicillin)", quantity: caseCount * 7, unit: "tablets", purpose: "Bacterial infection", dosage: "1 tablet every 8 hours" },
          { name: "Paracetamol 500mg", quantity: caseCount * 20, unit: "tablets", purpose: "Fever/pain relief", dosage: "500mg every 6 hours" },
          { name: "Vitamin C (1000mg)", quantity: caseCount * 10, unit: "tablets", purpose: "Immunity", dosage: "1 tablet daily" }
        ],
        vaccines: [],
        tools: [
          { name: "Digital Thermometer", quantity: Math.ceil(caseCount / 50), unit: "units", purpose: "Temperature monitoring" },
          { name: "Oximeter", quantity: Math.ceil(caseCount / 30), unit: "units", purpose: "O2 saturation monitoring" },
          { name: "Masks (N95)", quantity: caseCount * 5, unit: "pieces", purpose: "Infection control" },
          { name: "Hand Sanitizer", quantity: Math.ceil(caseCount / 20), unit: "liters", purpose: "Hygiene" }
        ],
        deploymentTeams: {
          doctors: Math.ceil(caseCount / 50),
          nurses: Math.ceil(caseCount / 15),
          fieldWorkers: Math.ceil(caseCount / 10),
          totalTeamSize: Math.ceil(caseCount / 50) + Math.ceil(caseCount / 15) + Math.ceil(caseCount / 10),
          rationale: "High nurse ratio for monitoring and symptom management"
        },
        actionPlan: [
          { day: 1, action: "Screen all contacts", responsible: "fieldWorkers", expectedOutcome: "Identify 80% of contacts" },
          { day: 1, action: "Distribute masks", responsible: "fieldWorkers", expectedOutcome: "100% coverage" },
          { day: 2, action: "Start antibiotic course", responsible: "nurses", expectedOutcome: "All cases medicated" },
          { day: 5, action: "Monitor O2 levels", responsible: "nurses", expectedOutcome: "Identify severe cases" },
          { day: 7, action: "Follow-up assessment", responsible: "doctors", expectedOutcome: "Track recovery" },
          { day: 10, action: "Conclude intervention", responsible: "doctors", expectedOutcome: "All recovered or referred" }
        ],
        estimatedCost: (caseCount * 150) + (Math.ceil(caseCount / 30) * 3000),
        notes: "Focus on early detection of severe cases. Maintain strict infection control measures."
      },
      gastro: {
        disease: "Gastroenteritis",
        severity: "mild",
        estimatedDuration: 7,
        medicines: [
          { name: "Oral Rehydration Salts (ORS)", quantity: caseCount * 30, unit: "sachets", purpose: "Rehydration", dosage: "As needed" },
          { name: "Antibiotic (Ciprofloxacin)", quantity: caseCount * 7, unit: "tablets", purpose: "Bacterial infection", dosage: "1 tablet every 12 hours" },
          { name: "Zinc Supplements", quantity: caseCount * 7, unit: "tablets", purpose: "Recovery", dosage: "1 tablet daily" },
          { name: "Probiotic", quantity: caseCount * 7, unit: "tablets", purpose: "Gut health", dosage: "1 tablet daily" }
        ],
        vaccines: [],
        tools: [
          { name: "Portable Water Filter", quantity: Math.ceil(caseCount / 100), unit: "units", purpose: "Water safety" },
          { name: "Thermometer", quantity: Math.ceil(caseCount / 50), unit: "units", purpose: "Temperature check" },
          { name: "Sanitation Supplies", quantity: caseCount, unit: "kits", purpose: "Hygiene" }
        ],
        deploymentTeams: {
          doctors: Math.ceil(caseCount / 100),
          nurses: Math.ceil(caseCount / 50),
          fieldWorkers: Math.ceil(caseCount / 10),
          totalTeamSize: Math.ceil(caseCount / 100) + Math.ceil(caseCount / 50) + Math.ceil(caseCount / 10),
          rationale: "Lower medical staff, emphasis on field education and sanitation"
        },
        actionPlan: [
          { day: 1, action: "Distribute ORS", responsible: "fieldWorkers", expectedOutcome: "100% ORS coverage" },
          { day: 1, action: "Educate on water safety", responsible: "fieldWorkers", expectedOutcome: "Community awareness" },
          { day: 2, action: "Start antibiotic course", responsible: "nurses", expectedOutcome: "All moderate cases treated" },
          { day: 3, action: "Improve water sources", responsible: "fieldWorkers", expectedOutcome: "Safe water access" },
          { day: 5, action: "Follow-up on recovery", responsible: "nurses", expectedOutcome: "Most cases recovered" },
          { day: 7, action: "Conclude intervention", responsible: "doctors", expectedOutcome: "Outbreak controlled" }
        ],
        estimatedCost: (caseCount * 100) + (Math.ceil(caseCount / 100) * 5000),
        notes: "Emphasize water safety and sanitation. Most cases are self-limiting with proper hydration."
      }
    };

    // Select appropriate fallback based on disease
    let selectedFallback = fallbackPlans.dengue;
    if (disease.toLowerCase().includes("respiratory") || disease.toLowerCase().includes("pneumonia") || disease.toLowerCase().includes("flu")) {
      selectedFallback = fallbackPlans.respiratory;
    } else if (disease.toLowerCase().includes("gastro") || disease.toLowerCase().includes("diarrhea")) {
      selectedFallback = fallbackPlans.gastro;
    }

    const storedPlan = {
      id: Date.now(),
      alertId,
      ...selectedFallback,
      createdAt: new Date().toISOString(),
      status: "pending"
    };

    resourcePlans.push(storedPlan);

    console.log("✅ Fallback Resource Plan Generated:", storedPlan);
    res.json(storedPlan);
  }
});

// Get resource plan
app.get("/api/v1/resources/plan/:planId", (req, res) => {
  const plan = resourcePlans.find(p => p.id === parseInt(req.params.planId));
  
  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  res.json(plan);
});

// Get all resource plans
app.get("/api/v1/resources/plans", (req, res) => {
  res.json(resourcePlans);
});

// Approve and deploy a resource plan
app.post("/api/v1/resources/plan/:planId/deploy", (req, res) => {
  const plan = resourcePlans.find(p => p.id === parseInt(req.params.planId));

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  plan.status = "deployed";
  plan.deployedAt = new Date().toISOString();

  // Create deployment teams
  const deployment = {
    id: Date.now(),
    planId: plan.id,
    teams: [
      {
        type: "doctors",
        count: plan.deploymentTeams.doctors,
        status: "deployed",
        deployedAt: new Date().toISOString()
      },
      {
        type: "nurses",
        count: plan.deploymentTeams.nurses,
        status: "deployed",
        deployedAt: new Date().toISOString()
      },
      {
        type: "fieldWorkers",
        count: plan.deploymentTeams.fieldWorkers,
        status: "deployed",
        deployedAt: new Date().toISOString()
      }
    ],
    totalPersonnel: plan.deploymentTeams.totalTeamSize,
    village: req.body.village,
    status: "active"
  };

  deploymentTeams.push(deployment);

  console.log("✅ Resource Plan Deployed:", deployment);
  res.json({ success: true, deployment });
});

// Update resource plan status
app.patch("/api/v1/resources/plan/:planId", (req, res) => {
  const { status } = req.body;
  const plan = resourcePlans.find(p => p.id === parseInt(req.params.planId));

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  plan.status = status;
  res.json(plan);
});

// Get deployment teams
app.get("/api/v1/deployment/teams", (req, res) => {
  res.json(deploymentTeams);
});

// =========================
// 🚀 START SERVER
// =========================
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
  console.log("📦 Resource Planning API ready");
});