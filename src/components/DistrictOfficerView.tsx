import { AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardList, FileText, MapPin, Shield, Truck } from "lucide-react";
import { useState } from "react";
import type { OutbreakAlert } from "@shared/types";
import { QueryError, SeverityBadge, StatCard, StatusBadge } from "@/components/common";
import DeploymentBriefDialog from "@/components/district/DeploymentBriefDialog";
import SurveillanceMap from "@/components/SurveillanceMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAlerts, useApiMutation, useStats } from "@/hooks/queries";
import { api } from "@/lib/api";
import { formatDateTime, SYMPTOM_LABELS } from "@/lib/labels";

export default function DistrictOfficerView() {
  const alerts = useAlerts();
  const stats = useStats();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const escalate = useApiMutation((id: string) => api.escalate(id));
  const resolve = useApiMutation((id: string) => api.resolve(id));

  const list = alerts.data ?? [];
  const selected = list.find((alert) => alert.id === selectedId) ?? null;
  const openAlerts = list.filter((alert) => alert.status !== "resolved");
  const resolved = list.filter((alert) => alert.status === "resolved");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Reports (last 7 days)" value={stats.data?.reportsLast7Days} />
        <StatCard icon={AlertTriangle} label="Active alerts" value={stats.data?.activeAlerts} tone="text-destructive" />
        <StatCard icon={Shield} label="Teams deployed" value={stats.data?.inProgressAlerts} tone="text-warning" />
        <StatCard icon={MapPin} label="Villages reporting" value={stats.data?.monitoredVillages} tone="text-info" />
      </div>

      <QueryError error={alerts.error ?? stats.error} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Village surveillance map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SurveillanceMap alerts={list} showLabels />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Outbreak alerts
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Raised automatically when reports from one village cross a syndrome threshold within 7 days. Open the deployment brief to dispatch a team.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.isLoading && <p className="py-6 text-center text-muted-foreground">Loading alerts…</p>}
          {!alerts.isLoading && openAlerts.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">No open alerts. New ones appear here as field reports sync.</p>
          )}
          {openAlerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onOpen={() => setSelectedId(alert.id)}
              onEscalate={() => escalate.mutate(alert.id)}
              onResolve={() => resolve.mutate(alert.id)}
              busy={escalate.isPending || resolve.isPending}
            />
          ))}
          {(escalate.error ?? resolve.error) && <p className="text-sm text-destructive">{(escalate.error ?? resolve.error)?.message}</p>}
        </CardContent>
      </Card>

      {resolved.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-success" /> Resolved ({resolved.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resolved.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedId(alert.id)}
                className="flex w-full items-center justify-between rounded-lg bg-muted/50 p-3 text-left text-sm hover:bg-muted"
              >
                <span>
                  <span className="font-medium">{alert.village}</span> · {alert.caseCount} {SYMPTOM_LABELS[alert.symptom].toLowerCase()} cases
                </span>
                <span className="text-xs text-muted-foreground">Resolved {alert.resolvedAt && formatDateTime(alert.resolvedAt)}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <DeploymentBriefDialog alert={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function AlertRow({
  alert,
  onOpen,
  onEscalate,
  onResolve,
  busy,
}: {
  alert: OutbreakAlert;
  onOpen: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-semibold">{alert.village}</span>
          <SeverityBadge severity={alert.severity} />
          <StatusBadge status={alert.status} />
          {alert.escalated && (
            <Badge variant="outline" className="border-primary/50 text-primary" title={alert.escalationReason}>
              Escalated to state
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {alert.caseCount} {SYMPTOM_LABELS[alert.symptom].toLowerCase()} cases in 7 days · raised {formatDateTime(alert.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {alert.status === "active" ? (
          <Button size="sm" onClick={onOpen} className="bg-warning text-warning-foreground hover:bg-warning/90">
            <Truck className="mr-1 h-4 w-4" /> Deploy medical team
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onOpen}>
            <ClipboardList className="mr-1 h-4 w-4" /> View brief
          </Button>
        )}
        {!alert.escalated && (
          <Button size="sm" variant="outline" onClick={onEscalate} disabled={busy}>
            <ArrowUpRight className="mr-1 h-4 w-4" /> Escalate to state
          </Button>
        )}
        {alert.status === "in-progress" && (
          <Button size="sm" variant="outline" onClick={onResolve} disabled={busy} className="border-success text-success hover:bg-success/10">
            <CheckCircle2 className="mr-1 h-4 w-4" /> Mark resolved
          </Button>
        )}
      </div>
    </div>
  );
}
