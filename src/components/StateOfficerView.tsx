import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Loader2, MapPin, PackageCheck, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SYMPTOMS } from "@shared/types";
import { QueryError, SeverityBadge, StatCard, StatusBadge } from "@/components/common";
import ResourcePlanCard from "@/components/state/ResourcePlanCard";
import SurveillanceMap from "@/components/SurveillanceMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAlerts, useApiMutation, usePlans, useStats, useTopVillages, useTrends } from "@/hooks/queries";
import { api } from "@/lib/api";
import { formatDay, SYMPTOM_COLORS, SYMPTOM_LABELS } from "@/lib/labels";

export default function StateOfficerView() {
  const stats = useStats();
  const alerts = useAlerts();
  const trends = useTrends();
  const topVillages = useTopVillages();
  const plans = usePlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const generate = useApiMutation((alertId: string) => api.generatePlan(alertId));
  const deploy = useApiMutation((planId: string) => api.deployPlan(planId));

  const openAlerts = (alerts.data ?? []).filter((alert) => alert.status !== "resolved");
  // Escalated alerts first — they are the ones that need state-level attention.
  const prioritized = [...openAlerts].sort((a, b) => Number(b.escalated) - Number(a.escalated));
  const planList = plans.data ?? [];
  const selectedPlan = planList.find((plan) => plan.id === selectedPlanId) ?? null;
  const trendData = (trends.data ?? []).map((point) => ({ ...point, label: formatDay(point.date) }));

  const handleGenerate = async (alertId: string) => {
    const plan = await generate.mutateAsync(alertId);
    setSelectedPlanId(plan.id);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Activity} label="Reports (last 7 days)" value={stats.data?.reportsLast7Days} />
        <StatCard icon={ArrowUpRight} label="Escalated alerts" value={stats.data?.escalatedAlerts} tone="text-destructive" />
        <StatCard icon={AlertTriangle} label="Open alerts" value={(stats.data?.activeAlerts ?? 0) + (stats.data?.inProgressAlerts ?? 0)} tone="text-warning" />
        <StatCard icon={PackageCheck} label="Resource plans deployed" value={stats.data?.deployedPlans} tone="text-success" />
      </div>

      <QueryError error={stats.error ?? alerts.error} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Syndromic trend — last 7 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {SYMPTOMS.map((symptom) => (
                  <Line
                    key={symptom}
                    type="monotone"
                    dataKey={symptom}
                    name={SYMPTOM_LABELS[symptom]}
                    stroke={SYMPTOM_COLORS[symptom]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most affected villages (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVillages.data ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="village" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="cases" name="Reports" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Outbreak map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SurveillanceMap alerts={alerts.data ?? []} height={256} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" /> Open alerts — resource planning
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate a medicines, equipment and action plan for an outbreak. Llama 3.3 drafts the plan; staffing is calculated from case counts.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {prioritized.length === 0 && <p className="py-6 text-center text-muted-foreground">No open alerts.</p>}
          {prioritized.map((alert) => {
            const generating = generate.isPending && generate.variables === alert.id;
            return (
              <div key={alert.id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{alert.village}</span>
                    <SeverityBadge severity={alert.severity} />
                    <StatusBadge status={alert.status} />
                    {alert.escalated && (
                      <Badge variant="outline" className="border-primary/50 text-primary" title={alert.escalationReason}>
                        Escalated
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {alert.caseCount} {SYMPTOM_LABELS[alert.symptom].toLowerCase()} cases in 7 days
                  </p>
                </div>
                <Button size="sm" onClick={() => void handleGenerate(alert.id)} disabled={generate.isPending}>
                  {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
                  {generating ? "Generating…" : "Generate resource plan"}
                </Button>
              </div>
            );
          })}
          {generate.error && <p className="text-sm text-destructive">{generate.error.message}</p>}
        </CardContent>
      </Card>

      {selectedPlan && (
        <ResourcePlanCard plan={selectedPlan} deploying={deploy.isPending} onDeploy={() => deploy.mutate(selectedPlan.id)} />
      )}
      {deploy.error && <p className="text-sm text-destructive">{deploy.error.message}</p>}

      {planList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resource plans ({planList.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {planList.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-left text-sm hover:bg-muted"
                aria-current={plan.id === selectedPlanId}
              >
                <span>
                  <span className="font-medium">{plan.village}</span> · {plan.condition} · {plan.staffing.total} personnel
                </span>
                {plan.status === "deployed" ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" /> Deployed
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Draft</span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
