import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStats, getAlerts, getTrendData, getTopAffectedVillages } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Activity, AlertTriangle, Shield, MapPin, TrendingUp, Users, Zap, Pill, Syringe, Wrench, Users2, CheckCircle2, AlertCircle, Loader, Clock, MapIcon } from "lucide-react";

interface Medicine {
  name: string;
  quantity: number;
  unit: string;
  purpose: string;
  dosage: string;
}

interface Vaccine {
  name: string;
  quantity: number;
  unit: string;
  target: string;
  purpose: string;
}

interface Tool {
  name: string;
  quantity: number;
  unit: string;
  purpose: string;
}

interface ActionItem {
  day: number;
  action: string;
  responsible: string;
  expectedOutcome: string;
}

interface ResourcePlan {
  id: number;
  alertId?: number;
  disease: string;
  severity: "mild" | "moderate" | "severe";
  estimatedDuration: number;
  medicines: Medicine[];
  vaccines: Vaccine[];
  tools: Tool[];
  deploymentTeams: {
    doctors: number;
    nurses: number;
    fieldWorkers: number;
    totalTeamSize: number;
    rationale: string;
  };
  actionPlan: ActionItem[];
  estimatedCost: number;
  notes: string;
  status: "pending" | "approved" | "deployed" | "completed";
  createdAt: string;
  deployedAt?: string;
}

export default function StateOfficerView() {
  const stats = getStats();
  const alerts = getAlerts();
  const trendData = getTrendData();
  const topVillages = getTopAffectedVillages();

  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [resourcePlan, setResourcePlan] = useState<ResourcePlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState("");
  const [deployedPlans, setDeployedPlans] = useState<ResourcePlan[]>([]);

  const activeCount = alerts.filter(a => a.status === "active").length;
  const inProgressCount = alerts.filter(a => a.status === "in-progress").length;
  const resolvedCount = alerts.filter(a => a.status === "resolved").length;

  // Generate AI resource plan
  const generateResourcePlan = async (alert: any) => {
    if (!alert) return;

    setGenerating(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:5000/api/v1/resources/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: alert.id,
          disease: alert.disease,
          affectedVillage: alert.village,
          caseCount: alert.cases
        })
      });

      const plan = await response.json();
      setResourcePlan(plan);
      setSelectedAlert(alert);
      setMessage("✅ AI Resource Plan Generated Successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error generating plan:", error);
      setMessage("❌ Error generating plan. Please try again.");
    }

    setGenerating(false);
  };

  // Deploy the resource plan
  const deployPlan = async () => {
    if (!resourcePlan || !selectedAlert) return;

    setDeploying(true);
    setMessage("");

    try {
      const response = await fetch(`http://localhost:5000/api/v1/resources/plan/${resourcePlan.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          village: selectedAlert.village
        })
      });

      const result = await response.json();

      if (result.success) {
        setDeployedPlans([...deployedPlans, { ...resourcePlan, status: "deployed" }]);
        setMessage(`✅ Deployed! ${resourcePlan.deploymentTeams.totalTeamSize} personnel sent to ${selectedAlert.village}`);
        setTimeout(() => {
          setResourcePlan(null);
          setSelectedAlert(null);
          setMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("Error deploying plan:", error);
      setMessage("❌ Error deploying plan. Please try again.");
    }

    setDeploying(false);
  };

  const getSeverityColor = (severity: string) => {
    if (severity === "severe") return "bg-destructive text-destructive-foreground";
    if (severity === "moderate") return "bg-warning text-warning-foreground";
    return "bg-success text-success-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { icon: Activity, label: "Total Reports", value: stats.totalReports, color: "text-primary" },
          { icon: AlertTriangle, label: "Active Alerts", value: activeCount, color: "text-destructive" },
          { icon: Shield, label: "Teams Deployed", value: deployedPlans.length, color: "text-warning" },
          { icon: MapPin, label: "Villages", value: stats.monitoredVillages, color: "text-info" },
          { icon: Users, label: "Resolved", value: resolvedCount, color: "text-success" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-6 text-center">
              <Icon className={`h-6 w-6 mx-auto mb-2 ${color}`} />
              <p className="text-3xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Disease Trend — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 15% 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="fever" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="diarrhea" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cough" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="rash" stroke="hsl(280 60% 50%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Affected Villages */}
        <Card>
          <CardHeader>
            <CardTitle>Top Affected Villages</CardTitle>
          </CardHeader>
          <CardContent>
            {topVillages.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No data yet</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topVillages} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 15% 88%)" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="village" tick={{ fontSize: 12 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="cases" fill="hsl(174 62% 38%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts - Generate Plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.filter(a => a.status === "active" || a.status === "Active").length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No active alerts</p>
            ) : (
              alerts
                .filter(a => a.status === "active" || a.status === "Active")
                .map(alert => (
                  <div key={alert.id} className="p-3 rounded-lg bg-muted/50 border border-destructive/30">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{alert.village}</p>
                        <p className="text-xs text-muted-foreground">{alert.cases} {alert.disease} cases</p>
                      </div>
                      <Badge className="bg-destructive text-destructive-foreground">ACTIVE</Badge>
                    </div>
                    <Button
                      onClick={() => generateResourcePlan(alert)}
                      disabled={generating}
                      size="sm"
                      className="w-full gap-2"
                    >
                      {generating ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Generating Plan...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Generate AI Plan
                        </>
                      )}
                    </Button>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Message Display */}
      {message && (
        <Card className={message.includes("✅") ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}>
          <CardContent className="flex items-center gap-3 py-3">
            {message.includes("✅") ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            <span className="text-sm">{message}</span>
          </CardContent>
        </Card>
      )}

      {/* Resource Plan Display */}
      {resourcePlan && selectedAlert && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  AI Resource Plan - {selectedAlert.village}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{selectedAlert.disease} outbreak | {selectedAlert.cases} cases</p>
              </div>
              <Badge className={getSeverityColor(resourcePlan.severity)}>
                {resourcePlan.severity.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Deployment Teams */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-background rounded-lg border">
              <div className="text-center">
                <Users2 className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{resourcePlan.deploymentTeams.doctors}</p>
                <p className="text-xs text-muted-foreground">Doctors</p>
              </div>
              <div className="text-center">
                <Activity className="h-6 w-6 mx-auto mb-2 text-red-500" />
                <p className="text-2xl font-bold">{resourcePlan.deploymentTeams.nurses}</p>
                <p className="text-xs text-muted-foreground">Nurses</p>
              </div>
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{resourcePlan.deploymentTeams.fieldWorkers}</p>
                <p className="text-xs text-muted-foreground">Field Workers</p>
              </div>
              <div className="text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{resourcePlan.deploymentTeams.totalTeamSize}</p>
                <p className="text-xs text-muted-foreground">Total Team</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground italic border-l-4 border-primary pl-4">
              {resourcePlan.deploymentTeams.rationale}
            </p>

            {/* Medicines */}
            {resourcePlan.medicines.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Pill className="h-5 w-5 text-red-500" />
                  Medicines ({resourcePlan.medicines.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {resourcePlan.medicines.map((med, i) => (
                    <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="font-medium text-sm">{med.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>Qty:</strong> {med.quantity} {med.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Purpose:</strong> {med.purpose}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Dosage:</strong> {med.dosage}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vaccines */}
            {resourcePlan.vaccines.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Syringe className="h-5 w-5 text-amber-500" />
                  Vaccines ({resourcePlan.vaccines.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {resourcePlan.vaccines.map((vac, i) => (
                    <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="font-medium text-sm">{vac.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>Qty:</strong> {vac.quantity} {vac.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Target:</strong> {vac.target}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tools */}
            {resourcePlan.tools.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-blue-500" />
                  Tools & Equipment ({resourcePlan.tools.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {resourcePlan.tools.map((tool, i) => (
                    <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="font-medium text-sm">{tool.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>Qty:</strong> {tool.quantity} {tool.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Purpose:</strong> {tool.purpose}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Plan */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                Intervention Timeline (Days 1-{resourcePlan.estimatedDuration})
              </h3>
              <div className="space-y-2">
                {resourcePlan.actionPlan.map((action, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border-l-4 border-purple-500">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">Day {action.day}: {action.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <strong>Lead:</strong> {action.responsible}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <strong>Goal:</strong> {action.expectedOutcome}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Total Cost</p>
                <p className="text-2xl font-bold">₹{resourcePlan.estimatedCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated Duration</p>
                <p className="text-2xl font-bold">{resourcePlan.estimatedDuration} Days</p>
              </div>
            </div>

            {resourcePlan.notes && (
              <div className="p-4 bg-info/5 border border-info/30 rounded-lg">
                <p className="text-sm text-info"><strong>Additional Notes:</strong> {resourcePlan.notes}</p>
              </div>
            )}

            {/* Deploy Button */}
            <Button
              onClick={deployPlan}
              disabled={deploying}
              size="lg"
              className="w-full py-6 text-lg gap-2"
            >
              {deploying ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Deploy This Plan to {selectedAlert.village}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Deployed Plans History */}
      {deployedPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Deployed Resource Plans ({deployedPlans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deployedPlans.map(plan => (
                <div key={plan.id} className="p-4 rounded-lg bg-success/5 border border-success/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold">{plan.disease}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.deploymentTeams.totalTeamSize} personnel deployed
                      </p>
                    </div>
                    <Badge className="bg-success text-success-foreground">DEPLOYED</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deployed: {new Date(plan.deployedAt || "").toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}