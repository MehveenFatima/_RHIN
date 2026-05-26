import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  getStats,
  getAlerts,
  deployTeam,
  resolveAlert,
  getVillages,
  getDeploymentBrief,
  updateDeploymentBrief,
  type DeploymentBrief,
  type OutbreakAlert,
} from "@/lib/store";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  MapPin,
  NotebookPen,
  PencilLine,
  Phone,
  Pill,
  Route,
  Save,
  Shield,
  Stethoscope,
  Truck,
} from "lucide-react";

type DeploymentFormState = {
  destinationVillage: string;
  outbreakSummary: string;
  outbreakDescription: string;
  medicines: string;
  medicalTools: string;
  otherRequirements: string;
  fieldInstructions: string;
  assemblyPoint: string;
  transportPlan: string;
  responseWindow: string;
  reportingInstructions: string;
  contactPoint: string;
  updatedAt: string;
};

function SeverityBadge({ severity }: { severity: string }) {
  const styles = {
    high: "bg-destructive text-destructive-foreground",
    medium: "bg-warning text-warning-foreground",
    low: "bg-info text-info-foreground",
  };

  return <Badge className={styles[severity as keyof typeof styles] || ""}>{severity.toUpperCase()}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="destructive">ACTIVE</Badge>;
  if (status === "in-progress") return <Badge className="bg-warning text-warning-foreground">IN PROGRESS</Badge>;
  return <Badge className="bg-success text-success-foreground">RESOLVED</Badge>;
}

function listToText(items: string[]) {
  return items.join("\n");
}

function textToList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function briefToFormState(brief: DeploymentBrief): DeploymentFormState {
  return {
    destinationVillage: brief.destinationVillage,
    outbreakSummary: brief.outbreakSummary,
    outbreakDescription: brief.outbreakDescription,
    medicines: listToText(brief.medicines),
    medicalTools: listToText(brief.medicalTools),
    otherRequirements: listToText(brief.otherRequirements),
    fieldInstructions: listToText(brief.fieldInstructions),
    assemblyPoint: brief.assemblyPoint,
    transportPlan: brief.transportPlan,
    responseWindow: brief.responseWindow,
    reportingInstructions: brief.reportingInstructions,
    contactPoint: brief.contactPoint,
    updatedAt: brief.updatedAt,
  };
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
  iconClassName: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-background p-2 shadow-sm">
          <Icon className={`h-4 w-4 ${iconClassName}`} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DetailPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm leading-6">{value || "Not added yet"}</p>
    </div>
  );
}

function ListPreview({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: typeof ClipboardList;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        <span>{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No details added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge key={`${title}-${item}`} variant="secondary" className="px-3 py-1 text-xs leading-5">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DistrictOfficerView() {
  const [, setTick] = useState(0);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [draftBrief, setDraftBrief] = useState<DeploymentFormState | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const refresh = () => setTick((tick) => tick + 1);

  const stats = getStats();
  const alerts = getAlerts();
  const villages = getVillages();
  const alertedVillages = new Set(alerts.filter((alert) => alert.status === "active").map((alert) => alert.village));

  const selectedAlert = selectedAlertId ? alerts.find((alert) => alert.id === selectedAlertId) ?? null : null;

  const loadBrief = (alertId: string) => {
    const brief = getDeploymentBrief(alertId);
    if (!brief) return null;
    setDraftBrief(briefToFormState(brief));
    return brief;
  };

  const openDeploymentView = (alert: OutbreakAlert) => {
    const brief = loadBrief(alert.id);
    if (!brief) return;

    setSelectedAlertId(alert.id);
    setIsEditing(alert.status === "active");
  };

  const closeDeploymentView = () => {
    setSelectedAlertId(null);
    setDraftBrief(null);
    setIsEditing(false);
  };

  const updateDraftField = (field: keyof DeploymentFormState, value: string) => {
    setDraftBrief((current) => (current ? { ...current, [field]: value } : current));
  };

  const persistBrief = () => {
    if (!selectedAlertId || !draftBrief) return null;

    const updatedBrief = updateDeploymentBrief(selectedAlertId, {
      destinationVillage: draftBrief.destinationVillage.trim(),
      outbreakSummary: draftBrief.outbreakSummary.trim(),
      outbreakDescription: draftBrief.outbreakDescription.trim(),
      medicines: textToList(draftBrief.medicines),
      medicalTools: textToList(draftBrief.medicalTools),
      otherRequirements: textToList(draftBrief.otherRequirements),
      fieldInstructions: textToList(draftBrief.fieldInstructions),
      assemblyPoint: draftBrief.assemblyPoint.trim(),
      transportPlan: draftBrief.transportPlan.trim(),
      responseWindow: draftBrief.responseWindow.trim(),
      reportingInstructions: draftBrief.reportingInstructions.trim(),
      contactPoint: draftBrief.contactPoint.trim(),
    });

    if (!updatedBrief) return null;

    setDraftBrief(briefToFormState(updatedBrief));
    return updatedBrief;
  };

  const handleSaveBrief = () => {
    const updatedBrief = persistBrief();
    if (!updatedBrief) return;
    setIsEditing(false);
    refresh();
  };

  const handleCancelEdit = () => {
    if (selectedAlertId) loadBrief(selectedAlertId);
    setIsEditing(false);
  };

  const handleDeployFromDialog = () => {
    if (!selectedAlertId) return;

    const updatedBrief = persistBrief();
    if (!updatedBrief) return;

    deployTeam(selectedAlertId);
    refresh();
    setIsEditing(false);
  };

  const handleResolve = (id: string) => {
    resolveAlert(id);
    refresh();
    setIsEditing(false);
  };

  const medicinesPreview = draftBrief ? textToList(draftBrief.medicines) : [];
  const toolsPreview = draftBrief ? textToList(draftBrief.medicalTools) : [];
  const requirementsPreview = draftBrief ? textToList(draftBrief.otherRequirements) : [];
  const instructionsPreview = draftBrief ? textToList(draftBrief.fieldInstructions) : [];

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalReports}</p>
                  <p className="text-xs text-muted-foreground">Total Reports</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeAlerts}</p>
                  <p className="text-xs text-muted-foreground">Active Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.monitoredVillages}</p>
                  <p className="text-xs text-muted-foreground">Villages Monitored</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgressAlerts}</p>
                  <p className="text-xs text-muted-foreground">Teams Deployed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Village Surveillance Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {villages.map((village) => {
                const isAlerting = alertedVillages.has(village);
                const hasInProgress = alerts.some((alert) => alert.village === village && alert.status === "in-progress");

                return (
                  <div
                    key={village}
                    className={`relative p-4 rounded-xl border-2 text-center transition-all ${
                      isAlerting
                        ? "border-destructive bg-destructive/5 shadow-lg shadow-destructive/10 animate-pulse"
                        : hasInProgress
                          ? "border-warning bg-warning/5"
                          : "border-border bg-card"
                    }`}
                  >
                    {isAlerting && <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-destructive animate-ping" />}
                    <MapPin
                      className={`h-6 w-6 mx-auto mb-1 ${
                        isAlerting ? "text-destructive" : hasInProgress ? "text-warning" : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-sm font-semibold">{village}</p>
                    {isAlerting && <p className="text-xs text-destructive font-medium mt-1">OUTBREAK</p>}
                    {hasInProgress && <p className="text-xs text-warning font-medium mt-1">Team Deployed</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Outbreak Alerts
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Open a deployment brief to review the destination village, outbreak details, medicines, tools, and field instructions before sending the team.
            </p>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No alerts detected yet. Sync reports from ASHA workers to trigger detection.</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">{alert.village}</span>
                          <SeverityBadge severity={alert.severity} />
                          <StatusBadge status={alert.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.caseCount} {alert.symptom} cases detected
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {alert.status === "active" && (
                        <Button size="sm" onClick={() => openDeploymentView(alert)} className="bg-warning hover:bg-warning/90 text-warning-foreground">
                          <Truck className="h-4 w-4 mr-1" />
                          Deploy Medical Team
                        </Button>
                      )}
                      {alert.status === "in-progress" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openDeploymentView(alert)}>
                            <ClipboardList className="h-4 w-4 mr-1" />
                            View or Edit Brief
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleResolve(alert.id)} className="border-success text-success hover:bg-success/10">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Mark Resolved
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedAlertId)} onOpenChange={(open) => !open && closeDeploymentView()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedAlert && draftBrief ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-warning" />
                  Deployment Brief for {selectedAlert.village}
                </DialogTitle>
                <DialogDescription>
                  Review the auto-filled dispatch plan, edit any field you want to change, and then send the instructions to the medical team.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryTile label="Destination" value={draftBrief.destinationVillage} icon={MapPin} iconClassName="text-primary" />
                <SummaryTile label="Priority" value={draftBrief.responseWindow} icon={Clock3} iconClassName="text-warning" />
                <SummaryTile label="Cases" value={`${selectedAlert.caseCount} suspected`} icon={AlertTriangle} iconClassName="text-destructive" />
                <SummaryTile label="Status" value={selectedAlert.status.replace("-", " ")} icon={Shield} iconClassName="text-success" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{selectedAlert.symptom.toUpperCase()}</Badge>
                <SeverityBadge severity={selectedAlert.severity} />
                <StatusBadge status={selectedAlert.status} />
                <Badge variant="outline">Last updated {formatUpdatedAt(draftBrief.updatedAt)}</Badge>
              </div>

              <Separator />

              {isEditing ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <span>Mission Overview</span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Destination Village</label>
                      <Input value={draftBrief.destinationVillage} onChange={(event) => updateDraftField("destinationVillage", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Outbreak Summary</label>
                      <Input value={draftBrief.outbreakSummary} onChange={(event) => updateDraftField("outbreakSummary", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Outbreak Description</label>
                      <Textarea
                        value={draftBrief.outbreakDescription}
                        onChange={(event) => updateDraftField("outbreakDescription", event.target.value)}
                        className="min-h-[140px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assembly Point</label>
                      <Input value={draftBrief.assemblyPoint} onChange={(event) => updateDraftField("assemblyPoint", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Response Window</label>
                      <Input value={draftBrief.responseWindow} onChange={(event) => updateDraftField("responseWindow", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Transport Plan</label>
                      <Textarea
                        value={draftBrief.transportPlan}
                        onChange={(event) => updateDraftField("transportPlan", event.target.value)}
                        className="min-h-[110px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <NotebookPen className="h-4 w-4 text-primary" />
                      <span>Medical Team Instructions</span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Medicines to Carry</label>
                      <Textarea
                        value={draftBrief.medicines}
                        onChange={(event) => updateDraftField("medicines", event.target.value)}
                        className="min-h-[110px]"
                        placeholder="One medicine per line"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Medical Tools to Carry</label>
                      <Textarea
                        value={draftBrief.medicalTools}
                        onChange={(event) => updateDraftField("medicalTools", event.target.value)}
                        className="min-h-[110px]"
                        placeholder="One tool per line"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Field Instructions</label>
                      <Textarea
                        value={draftBrief.fieldInstructions}
                        onChange={(event) => updateDraftField("fieldInstructions", event.target.value)}
                        className="min-h-[110px]"
                        placeholder="One instruction per line"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Other Requirements</label>
                      <Textarea
                        value={draftBrief.otherRequirements}
                        onChange={(event) => updateDraftField("otherRequirements", event.target.value)}
                        className="min-h-[110px]"
                        placeholder="PPE, logistics, communication notes, or other needs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reporting Instructions</label>
                      <Textarea
                        value={draftBrief.reportingInstructions}
                        onChange={(event) => updateDraftField("reportingInstructions", event.target.value)}
                        className="min-h-[110px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Local Contact / Coordination Point</label>
                      <Input value={draftBrief.contactPoint} onChange={(event) => updateDraftField("contactPoint", event.target.value)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <span>Mission Overview</span>
                      </div>
                      <DetailPreview label="Destination Village" value={draftBrief.destinationVillage} />
                      <DetailPreview label="Outbreak Summary" value={draftBrief.outbreakSummary} />
                      <DetailPreview label="Outbreak Description" value={draftBrief.outbreakDescription} />
                      <DetailPreview label="Assembly Point" value={draftBrief.assemblyPoint} />
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Route className="h-4 w-4 text-primary" />
                        <span>Operations Notes</span>
                      </div>
                      <DetailPreview label="Response Window" value={draftBrief.responseWindow} />
                      <DetailPreview label="Transport Plan" value={draftBrief.transportPlan} />
                      <DetailPreview label="Reporting Instructions" value={draftBrief.reportingInstructions} />
                      <div className="flex items-start gap-3 rounded-lg bg-background p-3">
                        <Phone className="h-4 w-4 text-primary mt-1" />
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Local Contact / Coordination Point</p>
                          <p className="text-sm leading-6">{draftBrief.contactPoint}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <ListPreview title="Medicines to Carry" items={medicinesPreview} icon={Pill} />
                    <ListPreview title="Medical Tools to Carry" items={toolsPreview} icon={Stethoscope} />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <ListPreview title="Field Instructions" items={instructionsPreview} icon={ClipboardList} />
                    <ListPreview title="Other Requirements" items={requirementsPreview} icon={NotebookPen} />
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button variant="outline" onClick={handleSaveBrief}>
                      <Save className="h-4 w-4 mr-1" />
                      Save Details
                    </Button>
                    {selectedAlert.status === "active" && (
                      <Button onClick={handleDeployFromDialog} className="bg-warning hover:bg-warning/90 text-warning-foreground">
                        <Truck className="h-4 w-4 mr-1" />
                        Send To Medical Team
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {selectedAlert.status !== "resolved" && (
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <PencilLine className="h-4 w-4 mr-1" />
                        Edit Details
                      </Button>
                    )}
                    {selectedAlert.status === "active" && (
                      <Button onClick={handleDeployFromDialog} className="bg-warning hover:bg-warning/90 text-warning-foreground">
                        <Truck className="h-4 w-4 mr-1" />
                        Send To Medical Team
                      </Button>
                    )}
                    {selectedAlert.status === "in-progress" && (
                      <Button variant="outline" onClick={() => handleResolve(selectedAlert.id)} className="border-success text-success hover:bg-success/10">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Resolved
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
