import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { addToOfflineQueue, getOfflineQueue, syncReports, getVillages, createAlertFromAI, type Symptom, type Gender } from "@/lib/store";
import { analyzeDiseaseFromSymptoms, type DiseaseAnalysis } from "@/lib/aiDiseaseAnalysis";
import {
  CloudUpload, Plus, WifiOff, AlertTriangle, CheckCircle2,
  Brain, Camera, Mic, MicOff, Upload, Stethoscope, ShieldAlert, X
} from "lucide-react";

const SYMPTOMS: { value: Symptom; label: string }[] = [
  { value: "fever", label: "🌡️ Fever" },
  { value: "cough", label: "🤧 Cough" },
  { value: "diarrhea", label: "💧 Diarrhea" },
  { value: "rash", label: "🔴 Rash" },
];

export default function AshaWorkerView() {
  const [village, setVillage] = useState("");
  const [symptom, setSymptom] = useState<Symptom | "">("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [queue, setQueue] = useState(getOfflineQueue());
  const [syncMessage, setSyncMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [alertCreated, setAlertCreated] = useState("");

  // AI Disease Analysis state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSymptoms, setAiSymptoms] = useState<Symptom[]>([]);
  const [speechText, setSpeechText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [aiResult, setAiResult] = useState<DiseaseAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleAddReport = () => {
    if (!village || !symptom || !patientName || !age || !gender) return;
    addToOfflineQueue({ village, symptom, patientName, age: parseInt(age), gender });
    setQueue(getOfflineQueue());
    setVillage("");
    setSymptom("");
    setPatientName("");
    setAge("");
    setGender("");
    setSyncMessage("");
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      const result = syncReports();
      setQueue(getOfflineQueue());
      setSyncMessage(`✅ All ${result.count} reports uploaded successfully`);
      setAiMessage(result.aiMessage);
      setSyncing(false);
    }, 800);
  };

  // Toggle symptom for AI analysis
  const toggleAiSymptom = (s: Symptom) => {
    setAiSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  // Photo handling
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Speech-to-text using Web Speech API
  const toggleSpeech = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setSpeechText(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Parse AI response from Groq and structure it
  const parseAiResponse = (text: string) => {
    // Extract disease (between "**Disease**:" and the next section)
    const diseaseMatch = text.match(/\*\*Disease\*\*:\s*([^\n]+)/i) || 
                         text.match(/Disease[:\*]*\s*([^\n]+)/i) ||
                         text.match(/1\.\s*\*\*Disease\*\*:\s*([^\n]+)/i);
    const disease = diseaseMatch ? diseaseMatch[1].trim() : "Unable to determine";

    // Extract risk level
    const riskMatch = text.match(/\*\*Risk level\*\*:\s*([^\n]+)/i) ||
                      text.match(/2\.\s*\*\*Risk level\*\*:\s*([^\n]+)/i) ||
                      text.match(/Risk level[:\*]*\s*([^\n]+)/i);
    const risk = riskMatch ? riskMatch[1].trim() : "Moderate";

    // Extract advice section (everything after Advice until the next major section)
    const adviceMatch = text.match(/\*\*Advice\*\*:\s*([\s\S]+?)(?=Confidence|$)/i) ||
                        text.match(/3\.\s*\*\*Advice\*\*:\s*([\s\S]+?)(?=Confidence|$)/i);
    const advice = adviceMatch ? adviceMatch[1].trim() : "";

    // Parse advice into bullet points
    const recommendations = advice
      .split(/[-•]\s*/)
      .filter(item => item.trim().length > 0 && item.trim().length < 200)
      .slice(0, 5);

    // Determine severity
    const severityText = risk.toLowerCase();
    let severity: "mild" | "moderate" | "severe" = "mild";
    if (severityText.includes("high") || severityText.includes("severe")) {
      severity = "severe";
    } else if (severityText.includes("moderate")) {
      severity = "moderate";
    }

    // Extract confidence (if available)
    const confidenceMatch = text.match(/Confidence[:\*]*\s*(\d+)%/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;

    return {
      predictedDisease: disease,
      confidence,
      severity,
      description: risk,
      recommendations: recommendations.length > 0 ? recommendations : [
        "Follow standard medical protocol",
        "Monitor vital signs regularly",
        "Refer to PHC if symptoms persist"
      ],
      riskFactors: ["AI-assisted analysis", "Requires clinical confirmation"]
    };
  };

  // Run AI analysis
  const runAnalysis = async () => {
    if (aiSymptoms.length === 0 && !speechText && !additionalNotes) return;

    setAnalyzing(true);
    setAlertCreated("");

    try {
      const res = await fetch("http://localhost:5000/api/v1/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          symptoms: aiSymptoms,
          notes: speechText + " " + additionalNotes
        })
      });

      const data = await res.json();
      
      // Parse the text response from Groq API
      const aiText = data.result || "";
      const parsedResult = parseAiResponse(aiText);

      setAiResult(parsedResult);

      // Auto-create alert if severe or moderate with multiple symptoms
      if ((parsedResult.severity === "severe" || parsedResult.severity === "moderate") && 
          aiSymptoms.length >= 2) {
       // NEW - CORRECT
const alert = createAlertFromAI(
  "Multiple villages",
  parsedResult.predictedDisease,
  parsedResult.severity,
  aiSymptoms[0] || "fever"
);
        
        if (alert) {
          setAlertCreated(
            `Alert created: ${parsedResult.predictedDisease} outbreak detected with ${parsedResult.confidence}% confidence`
          );
        }
      }

    } catch (error) {
      console.error("Analysis error:", error);
      setAiResult({
        predictedDisease: "Analysis Error",
        confidence: 0,
        severity: "mild",
        description: "Unable to connect to AI service. Please check your internet connection.",
        recommendations: [
          "Retry the analysis",
          "Check network connection",
          "Follow standard medical protocol"
        ],
        riskFactors: ["Network error", "Please try again"]
      });
    }

    setAnalyzing(false);
  };

  const severityColor = (s: string) => {
    if (s === "severe") return "text-destructive";
    if (s === "moderate") return "text-warning";
    return "text-success";
  };

  return (
    <div className="space-y-6">
      {/* Offline indicator */}
      <Card className="border-2 border-dashed border-warning/40 bg-warning/5">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-warning" />
            <span className="font-medium text-warning">Offline Mode — Reports saved locally</span>
          </div>
          <Badge variant="secondary" className="bg-warning/10 text-warning text-base px-4 py-1">
            {queue.length} pending
          </Badge>
        </CardContent>
      </Card>

      {/* Add Report Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Patient Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Patient Demographics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Patient Name</label>
              <Input
                placeholder="Enter patient name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Age</label>
              <Input
                type="number"
                placeholder="Age"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Gender</label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">👨 Male</SelectItem>
                  <SelectItem value="female">👩 Female</SelectItem>
                  <SelectItem value="other">⚧ Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Village & Symptom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Village Name</label>
              <Select value={village} onValueChange={(val) => setVillage(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select village" />
                </SelectTrigger>
                <SelectContent>
                  {getVillages().map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Symptom</label>
              <Select value={symptom} onValueChange={(v) => setSymptom(v as Symptom)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select symptom" />
                </SelectTrigger>
                <SelectContent>
                  {SYMPTOMS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAddReport} disabled={!village || !symptom || !patientName || !age || !gender} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Save Report Locally
          </Button>
        </CardContent>
      </Card>

      {/* Pending Reports */}
      {queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Reports ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {queue.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                  <div>
                    <span className="font-medium">{r.patientName}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{r.age}y / {r.gender}</span>
                    <span className="text-muted-foreground ml-2 text-xs">— {r.village}</span>
                  </div>
                  <Badge variant="outline">{r.symptom}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Button */}
      <Button
        onClick={handleSync}
        disabled={queue.length === 0 || syncing}
        size="lg"
        className="w-full text-lg py-6"
      >
        <CloudUpload className="h-5 w-5 mr-2" />
        {syncing ? "Syncing..." : `SYNC ${queue.length} Reports to Server`}
      </Button>

      {/* Sync Success */}
      {syncMessage && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <span className="font-medium text-success">{syncMessage}</span>
          </CardContent>
        </Card>
      )}

      {/* AI Guidance from sync */}
      {aiMessage && (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-info mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-info mb-1">AI Health Intelligence</p>
                <p className="text-sm">{aiMessage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ AI DISEASE ANALYSIS SECTION ============ */}
      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Brain className="h-5 w-5" />
              AI Disease Analysis
            </CardTitle>
            <Button
              variant={showAIPanel ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowAIPanel(!showAIPanel)}
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              {showAIPanel ? "Close" : "Open Analysis"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Select symptoms, upload photos, or speak to get AI-powered disease predictions
          </p>
        </CardHeader>

        {showAIPanel && (
          <CardContent className="space-y-5">
            {/* Symptom multi-select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select observed symptoms</label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => toggleAiSymptom(s.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      aiSymptoms.includes(s.value)
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-muted/50 border-border hover:bg-muted text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" /> Photo Input
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {photoPreview ? "Change Photo" : "Upload / Capture Photo"}
                </Button>
                {photoPreview && (
                  <Button variant="ghost" size="sm" onClick={removePhoto}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {photoPreview && (
                <div className="mt-2 relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Patient photo"
                    className="h-32 w-32 object-cover rounded-lg border shadow-sm"
                  />
                  <Badge className="absolute -top-2 -right-2 bg-success text-success-foreground text-xs">
                    Uploaded
                  </Badge>
                </div>
              )}
            </div>

            {/* Speech Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mic className="h-4 w-4" /> Voice Description
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleSpeech}
                  className={isListening ? "animate-pulse" : ""}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Start Speaking
                    </>
                  )}
                </Button>
                {isListening && (
                  <span className="text-xs text-destructive font-medium animate-pulse">● Recording...</span>
                )}
              </div>
              {speechText && (
                <div className="mt-2 p-3 rounded-lg bg-muted/50 border text-sm">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Transcribed speech:</p>
                  <p>{speechText}</p>
                </div>
              )}
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Notes (optional)</label>
              <Textarea
                placeholder="e.g. patient has had fever for 3 days, joint pain, headache..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Analyze Button */}
            <Button
              onClick={runAnalysis}
              disabled={aiSymptoms.length === 0 && !speechText && !additionalNotes}
              className="w-full py-5 text-base"
              size="lg"
            >
              <Brain className="h-5 w-5 mr-2" />
              {analyzing ? "Analyzing..." : "🔬 Run AI Disease Analysis"}
            </Button>

            {/* AI Result */}
            {aiResult && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="py-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-lg">{aiResult.predictedDisease}</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          Confidence: {aiResult.confidence}%
                        </Badge>
                        <Badge className={`text-xs ${
                          aiResult.severity === "severe" ? "bg-destructive" :
                          aiResult.severity === "moderate" ? "bg-warning text-warning-foreground" :
                          "bg-success"
                        }`}>
                          {aiResult.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">{aiResult.description}</p>

                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      📋 Recommended Actions:
                    </h4>
                    <ul className="space-y-1.5">
                      {aiResult.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">⚠️ Risk Factors:</h4>
                    <div className="flex flex-wrap gap-2">
                      {aiResult.riskFactors.map((rf, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                          {rf}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground italic border-t pt-3">
                    ⚕️ This is an AI-assisted preliminary analysis. Always confirm with clinical examination and laboratory tests. Refer to PHC/CHC for definitive diagnosis.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Alert auto-created notification */}
            {alertCreated && (
              <Card className="border-2 border-destructive/40 bg-destructive/5 animate-in fade-in">
                <CardContent className="flex items-start gap-3 py-4">
                  <ShieldAlert className="h-6 w-6 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-destructive mb-1">Outbreak Alert Auto-Created</p>
                    <p className="text-sm">{alertCreated}</p>
                    <p className="text-xs text-muted-foreground mt-2">Switch to District Officer view to see the alert and deploy a medical team.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}