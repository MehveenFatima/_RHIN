import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GENDERS, SYMPTOMS, type Gender, type Symptom } from "@shared/types";
import { VILLAGE_NAMES } from "@shared/villages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { SYMPTOM_LABELS } from "@/lib/labels";

export interface ReportPrefill {
  symptom?: Symptom;
  age?: number;
  /** Changes on every prefill so the same values can be applied twice. */
  token: number;
}

const GENDER_LABELS: Record<Gender, string> = { male: "Male", female: "Female", other: "Other" };

export default function ReportForm({ prefill }: { prefill?: ReportPrefill }) {
  const { addReport, online } = useOfflineSync();
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [village, setVillage] = useState("");
  const [symptom, setSymptom] = useState<Symptom | "">("");

  useEffect(() => {
    if (!prefill) return;
    if (prefill.symptom) setSymptom(prefill.symptom);
    if (prefill.age !== undefined) setAge(String(prefill.age));
  }, [prefill]);

  const ageNumber = Number(age);
  const ageValid = age !== "" && Number.isInteger(ageNumber) && ageNumber >= 0 && ageNumber <= 120;
  const valid = patientName.trim() !== "" && ageValid && gender !== "" && village !== "" && symptom !== "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    addReport({ patientName: patientName.trim(), age: ageNumber, gender: gender as Gender, village, symptom: symptom as Symptom });
    toast.success(online ? "Report saved — sending to server" : "Report saved on this device", {
      description: `${patientName.trim()}, ${village} · ${SYMPTOM_LABELS[symptom as Symptom]}`,
    });
    setPatientName("");
    setAge("");
    setGender("");
    setSymptom("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" /> Add patient report
        </CardTitle>
        <p className="text-sm text-muted-foreground">Works offline — reports are queued on the device and synced automatically.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="patient-name">Patient name</Label>
              <Input id="patient-name" value={patientName} maxLength={80} onChange={(e) => setPatientName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-age">Age (years)</Label>
              <Input
                id="patient-age"
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                aria-invalid={age !== "" && !ageValid}
                placeholder="0–120"
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
                <SelectTrigger aria-label="Gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {GENDER_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Village</Label>
              <Select value={village} onValueChange={setVillage}>
                <SelectTrigger aria-label="Village">
                  <SelectValue placeholder="Select village" />
                </SelectTrigger>
                <SelectContent>
                  {VILLAGE_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Main symptom</Label>
              <Select value={symptom} onValueChange={(value) => setSymptom(value as Symptom)}>
                <SelectTrigger aria-label="Main symptom">
                  <SelectValue placeholder="Select symptom" />
                </SelectTrigger>
                <SelectContent>
                  {SYMPTOMS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SYMPTOM_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={!valid} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Save report
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
