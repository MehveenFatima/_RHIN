import { useMutation } from "@tanstack/react-query";
import { AlertOctagon, Brain, ClipboardPlus, Hospital, Loader2, Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SYMPTOMS, type Symptom } from "@shared/types";
import { SeverityBadge, SourceBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { api } from "@/lib/api";
import { SYMPTOM_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

// Minimal typing for the Web Speech API (not yet in lib.dom for all browsers).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const SPEECH_LANGUAGES = [
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "हिन्दी (Hindi)" },
  { value: "te-IN", label: "తెలుగు (Telugu)" },
];

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function TriagePanel({ onUseInReport }: { onUseInReport: (symptom: Symptom, age?: number) => void }) {
  const { online } = useOfflineSync();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [age, setAge] = useState("");
  const [notes, setNotes] = useState("");
  const [language, setLanguage] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const triage = useMutation({ mutationFn: api.triage });

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleSymptom = (symptom: Symptom) =>
    setSymptoms((current) => (current.includes(symptom) ? current.filter((s) => s !== symptom) : [...current, symptom]));

  const toggleSpeech = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setSpeechError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setSpeechError("");
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) setNotes((current) => `${current}${current ? " " : ""}${transcript.trim()}`);
    };
    recognition.onerror = () => {
      setSpeechError("Voice input stopped (microphone permission or network issue).");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const ageNumber = age === "" ? undefined : Number(age);
  const canAnalyze = (symptoms.length > 0 || notes.trim() !== "") && online && !triage.isPending;

  const analyze = () =>
    triage.mutate({
      symptoms,
      notes: notes.trim() || undefined,
      age: ageNumber !== undefined && Number.isInteger(ageNumber) && ageNumber >= 0 && ageNumber <= 120 ? ageNumber : undefined,
    });

  const result = triage.data;

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Brain className="h-5 w-5" /> AI-assisted triage
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Describe the patient by selecting symptoms, typing or speaking. Llama 3.3 (via Groq) suggests a likely condition and next steps;
          if the AI service is unavailable a rule-based engine answers instead.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Observed symptoms</Label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map((symptom) => (
              <button
                key={symptom}
                type="button"
                aria-pressed={symptoms.includes(symptom)}
                onClick={() => toggleSymptom(symptom)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  symptoms.includes(symptom) ? "border-primary bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
                )}
              >
                {SYMPTOM_LABELS[symptom]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="triage-age">Age (optional)</Label>
            <Input id="triage-age" type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Voice notes</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={language} onValueChange={setLanguage} disabled={listening}>
                <SelectTrigger className="w-[180px]" aria-label="Voice language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEECH_LANGUAGES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant={listening ? "destructive" : "outline"} onClick={toggleSpeech}>
                {listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                {listening ? "Stop" : "Speak"}
              </Button>
              {listening && <span className="animate-pulse text-xs font-medium text-destructive">● Listening…</span>}
            </div>
            {speechError && <p className="text-xs text-destructive">{speechError}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="triage-notes">Notes</Label>
          <Textarea
            id="triage-notes"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. fever for 3 days with joint pain and headache"
          />
        </div>

        <Button onClick={analyze} disabled={!canAnalyze} size="lg" className="w-full">
          {triage.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Brain className="mr-2 h-5 w-5" />}
          {triage.isPending ? "Analysing…" : "Analyse"}
        </Button>
        {!online && <p className="text-center text-xs text-muted-foreground">Triage needs a connection. Reports can still be saved offline.</p>}
        {triage.error && <p className="text-sm text-destructive">{triage.error.message}</p>}

        {result && (
          <div className="space-y-4 rounded-xl border-2 border-primary/20 bg-primary/5 p-5" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="mr-2 text-lg font-bold">{result.likelyCondition}</h3>
              <SeverityBadge severity={result.riskLevel} />
              <SourceBadge source={result.source} model={result.model} fallbackReason={result.fallbackReason} />
            </div>
            <p className="text-sm text-muted-foreground">{result.summary}</p>

            {result.referToPHC && (
              <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">
                <Hospital className="h-4 w-4" /> Refer to the PHC
              </p>
            )}

            <div>
              <h4 className="mb-2 text-sm font-semibold">Recommended actions</h4>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {result.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>

            {result.redFlags.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                  <AlertOctagon className="h-4 w-4 text-destructive" /> Danger signs — refer urgently if present
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {result.redFlags.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {symptoms.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => onUseInReport(symptoms[0], ageNumber)}>
                <ClipboardPlus className="mr-2 h-4 w-4" /> Use in patient report
              </Button>
            )}

            <p className="border-t pt-3 text-xs italic text-muted-foreground">
              Decision support only — not a diagnosis. Confirm with clinical examination and laboratory tests.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
