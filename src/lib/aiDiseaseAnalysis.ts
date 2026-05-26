// Rule-based AI disease prediction engine

export interface DiseaseAnalysis {
  predictedDisease: string;
  confidence: number;
  description: string;
  recommendations: string[];
  severity: "mild" | "moderate" | "severe";
  riskFactors: string[];
}

interface SymptomProfile {
  symptoms: string[];
  photoDescription?: string;
  speechTranscript?: string;
  village?: string;
}

const DISEASE_DATABASE: {
  disease: string;
  matchSymptoms: string[];
  keywords: string[];
  description: string;
  recommendations: string[];
  severity: "mild" | "moderate" | "severe";
  riskFactors: string[];
}[] = [
  {
    disease: "Dengue Fever",
    matchSymptoms: ["fever", "rash"],
    keywords: ["headache", "joint pain", "mosquito", "body ache", "platelet", "bleeding"],
    description: "Dengue is a mosquito-borne viral infection causing high fever and rash. Common in tropical rural areas with stagnant water.",
    recommendations: [
      "Monitor platelet count immediately",
      "Ensure oral rehydration therapy (ORT)",
      "Avoid aspirin and NSAIDs",
      "Use mosquito nets and repellents in the village",
      "Report to PHC for blood test confirmation",
    ],
    severity: "severe",
    riskFactors: ["Stagnant water near homes", "Lack of mosquito nets", "Monsoon season"],
  },
  {
    disease: "Cholera / Acute Diarrheal Disease",
    matchSymptoms: ["diarrhea"],
    keywords: ["watery", "vomiting", "dehydration", "water", "contaminated", "stool"],
    description: "Acute watery diarrhea potentially caused by contaminated water sources. Can lead to severe dehydration rapidly.",
    recommendations: [
      "Start ORS (Oral Rehydration Solution) immediately",
      "Refer to nearest PHC if dehydration is severe",
      "Test village water supply for contamination",
      "Distribute water purification tablets",
      "Educate on handwashing with soap",
    ],
    severity: "severe",
    riskFactors: ["Contaminated water supply", "Open defecation", "Poor sanitation"],
  },
  {
    disease: "Acute Respiratory Infection (ARI)",
    matchSymptoms: ["cough", "fever"],
    keywords: ["breathing", "chest", "cold", "pneumonia", "wheezing", "phlegm", "sore throat"],
    description: "Upper or lower respiratory tract infection. Could indicate pneumonia if accompanied by rapid breathing.",
    recommendations: [
      "Check respiratory rate — refer if >30/min in adults",
      "Start empirical antibiotics if bacterial suspected",
      "Monitor oxygen saturation if available",
      "Keep patient warm and hydrated",
      "Isolate if TB is suspected",
    ],
    severity: "moderate",
    riskFactors: ["Indoor air pollution (chulha smoke)", "Overcrowded living", "Malnutrition"],
  },
  {
    disease: "Malaria",
    matchSymptoms: ["fever"],
    keywords: ["chills", "sweating", "cyclical", "mosquito", "shivering", "anemia", "spleen"],
    description: "Mosquito-borne parasitic infection causing cyclical fever with chills and sweating.",
    recommendations: [
      "Perform Rapid Diagnostic Test (RDT) for malaria",
      "Start ACT (Artemisinin Combination Therapy) if positive",
      "Ensure bed net usage for all household members",
      "Indoor residual spraying in the village",
      "Monitor for severe malaria signs (jaundice, altered consciousness)",
    ],
    severity: "severe",
    riskFactors: ["Forest-fringe village", "Lack of bed nets", "Rainy season"],
  },
  {
    disease: "Measles",
    matchSymptoms: ["rash", "fever"],
    keywords: ["spots", "eye", "red", "koplik", "vaccination", "contagious"],
    description: "Highly contagious viral illness with characteristic rash. Dangerous in unvaccinated children.",
    recommendations: [
      "Check vaccination status of patient and contacts",
      "Isolate the patient to prevent spread",
      "Provide Vitamin A supplementation",
      "Ring vaccination of unvaccinated children in village",
      "Report to district surveillance officer",
    ],
    severity: "moderate",
    riskFactors: ["Low vaccination coverage", "Malnutrition", "Overcrowded conditions"],
  },
  {
    disease: "Gastroenteritis",
    matchSymptoms: ["diarrhea"],
    keywords: ["stomach", "nausea", "cramps", "food", "vomit"],
    description: "Inflammation of the stomach and intestines, usually from food or waterborne pathogens.",
    recommendations: [
      "Maintain hydration with ORS",
      "BRAT diet (bananas, rice, applesauce, toast)",
      "Avoid dairy and fatty foods temporarily",
      "Monitor for signs of dehydration",
      "Test food and water sources if multiple cases",
    ],
    severity: "mild",
    riskFactors: ["Unsafe food handling", "Contaminated water", "Poor hygiene"],
  },
  {
    disease: "Skin Infection / Scabies",
    matchSymptoms: ["rash"],
    keywords: ["itching", "boils", "wound", "skin", "pus", "scratching"],
    description: "Skin infection or parasitic infestation common in areas with poor hygiene and overcrowded living.",
    recommendations: [
      "Apply prescribed topical treatment",
      "Treat all household members simultaneously",
      "Wash and sun-dry all clothing and bedding",
      "Maintain personal hygiene",
      "Refer for secondary bacterial infection if pus present",
    ],
    severity: "mild",
    riskFactors: ["Overcrowded living", "Lack of clean water", "Poor hygiene practices"],
  },
  {
    disease: "Tuberculosis (suspected)",
    matchSymptoms: ["cough"],
    keywords: ["weeks", "blood", "weight loss", "night sweats", "chronic", "tb", "sputum"],
    description: "If cough persists >2 weeks with weight loss or night sweats, TB must be ruled out.",
    recommendations: [
      "Collect sputum sample for CBNAAT/microscopy",
      "Refer to DOTS center immediately",
      "Screen household contacts",
      "Ensure nutritional support",
      "Follow NTEP (National TB Elimination Programme) guidelines",
    ],
    severity: "severe",
    riskFactors: ["Malnutrition", "HIV co-infection", "Overcrowded housing", "Previous TB contact"],
  },
];

export function analyzeDiseaseFromSymptoms(profile: SymptomProfile): DiseaseAnalysis {
  const { symptoms, speechTranscript, photoDescription } = profile;
  
  // Combine all text inputs for keyword matching
  const allText = [
    ...symptoms,
    speechTranscript || "",
    photoDescription || "",
  ].join(" ").toLowerCase();

  let bestMatch = DISEASE_DATABASE[0];
  let bestScore = 0;

  for (const disease of DISEASE_DATABASE) {
    let score = 0;

    // Primary symptom match (high weight)
    for (const s of disease.matchSymptoms) {
      if (symptoms.includes(s)) score += 10;
    }

    // Keyword match from speech/text (lower weight)
    for (const kw of disease.keywords) {
      if (allText.includes(kw)) score += 3;
    }

    // Multiple symptoms matching = higher confidence
    const symptomMatchCount = disease.matchSymptoms.filter(s => symptoms.includes(s)).length;
    if (symptomMatchCount > 1) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = disease;
    }
  }

  // Calculate confidence based on score
  const confidence = Math.min(95, Math.max(40, bestScore * 5 + 30));

  return {
    predictedDisease: bestMatch.disease,
    confidence,
    description: bestMatch.description,
    recommendations: bestMatch.recommendations,
    severity: bestMatch.severity,
    riskFactors: bestMatch.riskFactors,
  };
}
