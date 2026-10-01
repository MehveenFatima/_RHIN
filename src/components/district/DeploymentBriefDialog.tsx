import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock3, Loader2, MapPin, NotebookPen, PencilLine, Phone, Pill, Route, Save, Stethoscope, Truck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { DeploymentBrief, DeploymentBriefUpdate, OutbreakAlert } from "@shared/types";
import { SeverityBadge, StatusBadge } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useApiMutation } from "@/hooks/queries";
import { api } from "@/lib/api";
import { formatDateTime, SYMPTOM_LABELS } from "@/lib/labels";

type TextField = Exclude<keyof DeploymentBriefUpdate, ListField>;
type ListField = "medicines" | "medicalTools" | "otherRequirements" | "fieldInstructions";
type Draft = Record<TextField | ListField, string>;

const LIST_FIELDS: ListField[] = ["medicines", "medicalTools", "otherRequirements", "fieldInstructions"];

const toDraft = (brief: DeploymentBrief): Draft => ({
  destinationVillage: brief.destinationVillage,
  outbreakSummary: brief.outbreakSummary,
  outbreakDescription: brief.outbreakDescription,
  assemblyPoint: brief.assemblyPoint,
  transportPlan: brief.transportPlan,
  responseWindow: brief.responseWindow,
  reportingInstructions: brief.reportingInstructions,
  contactPoint: brief.contactPoint,
  medicines: brief.medicines.join("\n"),
  medicalTools: brief.medicalTools.join("\n"),
  otherRequirements: brief.otherRequirements.join("\n"),
  fieldInstructions: brief.fieldInstructions.join("\n"),
});

const toList = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

function toUpdate(draft: Draft): DeploymentBriefUpdate {
  const update: DeploymentBriefUpdate = {};
  for (const [key, value] of Object.entries(draft) as [keyof Draft, string][]) {
    if (LIST_FIELDS.includes(key as ListField)) update[key as ListField] = toList(value);
    else if (value.trim()) update[key as TextField] = value.trim();
  }
  return update;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm leading-6">{value}</p>
    </div>
  );
}

function ListPreview({ title, items, icon: Icon }: { title: string; items: string[]; icon: typeof Pill }) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="px-3 py-1 text-xs">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function DeploymentBriefDialog({ alert, onClose }: { alert: OutbreakAlert | null; onClose: () => void }) {
  const open = alert !== null;
  const brief = useQuery({ queryKey: ["brief", alert?.id], queryFn: () => api.brief(alert!.id), enabled: open });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);

  const save = useApiMutation((update: DeploymentBriefUpdate) => api.updateBrief(alert!.id, update));
  const deploy = useApiMutation(async (update: DeploymentBriefUpdate) => {
    await api.updateBrief(alert!.id, update);
    return api.deployTeam(alert!.id);
  });

  useEffect(() => {
    if (brief.data) setDraft(toDraft(brief.data));
  }, [brief.data]);

  useEffect(() => {
    setEditing(false);
  }, [alert?.id]);

  const set = (field: keyof Draft) => (value: string) => setDraft((current) => (current ? { ...current, [field]: value } : current));
  const readOnly = alert?.status === "resolved";
  const busy = save.isPending || deploy.isPending;
  const error = save.error ?? deploy.error ?? brief.error;

  const handleSave = async () => {
    if (!draft) return;
    await save.mutateAsync(toUpdate(draft));
    await brief.refetch();
    setEditing(false);
  };

  const handleCancel = () => {
    if (brief.data) setDraft(toDraft(brief.data));
    setEditing(false);
  };

  const handleDeploy = async () => {
    if (!draft) return;
    await deploy.mutateAsync(toUpdate(draft));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        {alert && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-warning" /> Deployment brief — {alert.village}
              </DialogTitle>
              <DialogDescription>
                Generated automatically from the outbreak alert. Review and edit anything before sending the medical team.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{SYMPTOM_LABELS[alert.symptom]}</Badge>
              <Badge variant="outline">{alert.caseCount} cases / 7 days</Badge>
              <SeverityBadge severity={alert.severity} />
              <StatusBadge status={alert.status} />
              {brief.data && <Badge variant="outline">Updated {formatDateTime(brief.data.updatedAt)}</Badge>}
            </div>

            <Separator />

            {!draft ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading brief…
              </div>
            ) : editing ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <ClipboardList className="h-4 w-4 text-primary" /> Mission overview
                  </p>
                  <Field htmlFor="brief-destinationVillage" label="Destination">
                    <Input id="brief-destinationVillage" value={draft.destinationVillage} onChange={(e) => set("destinationVillage")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-outbreakSummary" label="Outbreak summary">
                    <Input id="brief-outbreakSummary" value={draft.outbreakSummary} onChange={(e) => set("outbreakSummary")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-outbreakDescription" label="Outbreak description">
                    <Textarea id="brief-outbreakDescription" className="min-h-[120px]" value={draft.outbreakDescription} onChange={(e) => set("outbreakDescription")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-assemblyPoint" label="Assembly point">
                    <Input id="brief-assemblyPoint" value={draft.assemblyPoint} onChange={(e) => set("assemblyPoint")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-responseWindow" label="Response window">
                    <Input id="brief-responseWindow" value={draft.responseWindow} onChange={(e) => set("responseWindow")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-transportPlan" label="Transport plan">
                    <Textarea id="brief-transportPlan" value={draft.transportPlan} onChange={(e) => set("transportPlan")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-contactPoint" label="Contact / coordination point">
                    <Input id="brief-contactPoint" value={draft.contactPoint} onChange={(e) => set("contactPoint")(e.target.value)} />
                  </Field>
                </div>
                <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <NotebookPen className="h-4 w-4 text-primary" /> Team instructions (one item per line)
                  </p>
                  <Field htmlFor="brief-medicines" label="Medicines to carry">
                    <Textarea id="brief-medicines" className="min-h-[100px]" value={draft.medicines} onChange={(e) => set("medicines")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-medicalTools" label="Medical tools to carry">
                    <Textarea id="brief-medicalTools" className="min-h-[100px]" value={draft.medicalTools} onChange={(e) => set("medicalTools")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-fieldInstructions" label="Field instructions">
                    <Textarea id="brief-fieldInstructions" className="min-h-[100px]" value={draft.fieldInstructions} onChange={(e) => set("fieldInstructions")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-otherRequirements" label="Other requirements">
                    <Textarea id="brief-otherRequirements" className="min-h-[100px]" value={draft.otherRequirements} onChange={(e) => set("otherRequirements")(e.target.value)} />
                  </Field>
                  <Field htmlFor="brief-reportingInstructions" label="Reporting instructions">
                    <Textarea id="brief-reportingInstructions" value={draft.reportingInstructions} onChange={(e) => set("reportingInstructions")(e.target.value)} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <MapPin className="h-4 w-4 text-primary" /> Mission overview
                    </p>
                    <Preview label="Destination" value={draft.destinationVillage} />
                    <Preview label="Summary" value={draft.outbreakSummary} />
                    <Preview label="Description" value={draft.outbreakDescription} />
                    <Preview label="Assembly point" value={draft.assemblyPoint} />
                  </div>
                  <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Route className="h-4 w-4 text-primary" /> Operations
                    </p>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Clock3 className="h-4 w-4 text-warning" /> {draft.responseWindow}
                    </p>
                    <Preview label="Transport plan" value={draft.transportPlan} />
                    <Preview label="Reporting instructions" value={draft.reportingInstructions} />
                    <p className="flex items-start gap-2 text-sm">
                      <Phone className="mt-0.5 h-4 w-4 text-primary" /> {draft.contactPoint}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ListPreview title="Medicines to carry" items={toList(draft.medicines)} icon={Pill} />
                  <ListPreview title="Medical tools to carry" items={toList(draft.medicalTools)} icon={Stethoscope} />
                  <ListPreview title="Field instructions" items={toList(draft.fieldInstructions)} icon={ClipboardList} />
                  <ListPreview title="Other requirements" items={toList(draft.otherRequirements)} icon={NotebookPen} />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error.message}</p>}

            <DialogFooter className="gap-2">
              {editing ? (
                <>
                  <Button variant="outline" disabled={busy} onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void handleSave()}>
                    <Save className="mr-1 h-4 w-4" /> Save changes
                  </Button>
                </>
              ) : (
                !readOnly && (
                  <Button variant="outline" disabled={!draft} onClick={() => setEditing(true)}>
                    <PencilLine className="mr-1 h-4 w-4" /> Edit
                  </Button>
                )
              )}
              {alert.status === "active" && (
                <Button disabled={busy || !draft} onClick={() => void handleDeploy()} className="bg-warning text-warning-foreground hover:bg-warning/90">
                  {deploy.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Truck className="mr-1 h-4 w-4" />}
                  Send to medical team
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
