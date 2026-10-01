import { CalendarDays, CheckCircle2, Loader2, Pill, Users, Wrench } from "lucide-react";
import type { PlanItem, ResourcePlan } from "@shared/types";
import { SourceBadge } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, SYMPTOM_LABELS } from "@/lib/labels";

function ItemGrid({ items }: { items: PlanItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.name} className="rounded-lg border bg-background p-3">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {item.quantity.toLocaleString("en-IN")} {item.unit}
            </span>{" "}
            · {item.purpose}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function ResourcePlanCard({
  plan,
  onDeploy,
  deploying,
}: {
  plan: ResourcePlan;
  onDeploy: () => void;
  deploying: boolean;
}) {
  const staff = [
    { label: "Doctors", value: plan.staffing.doctors },
    { label: "Nurses", value: plan.staffing.nurses },
    { label: "Field workers", value: plan.staffing.fieldWorkers },
    { label: "Total team", value: plan.staffing.total },
  ];

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            Resource plan — {plan.village}: {plan.condition}
          </CardTitle>
          {plan.status === "deployed" ? (
            <Badge className="bg-success text-success-foreground hover:bg-success">Deployed</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {plan.caseCount} {SYMPTOM_LABELS[plan.symptom].toLowerCase()} cases · generated {formatDateTime(plan.createdAt)}
          </span>
          <SourceBadge source={plan.source} model={plan.model} fallbackReason={plan.fallbackReason} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Response team
          </h3>
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 md:grid-cols-4">
            {staff.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Staffing rule: 1 doctor per 50 cases, 1 nurse per 20, 1 field worker per 10.</p>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Pill className="h-4 w-4 text-destructive" /> Medicines
          </h3>
          <ItemGrid items={plan.medicines} />
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4 text-info" /> Equipment &amp; supplies
          </h3>
          <ItemGrid items={plan.equipment} />
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" /> Action plan ({plan.durationDays} days)
          </h3>
          <ol className="space-y-2">
            {plan.actions.map((action) => (
              <li key={`${action.day}-${action.action}`} className="rounded-lg border-l-4 border-primary bg-muted/50 p-3 text-sm">
                <span className="font-semibold">Day {action.day}:</span> {action.action}
                <span className="ml-2 text-xs text-muted-foreground">— {action.responsible}</span>
              </li>
            ))}
          </ol>
        </div>

        {plan.notes && <p className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">{plan.notes}</p>}

        {plan.status === "draft" ? (
          <Button onClick={onDeploy} disabled={deploying} size="lg" className="w-full">
            {deploying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
            Approve &amp; deploy resources to {plan.village}
          </Button>
        ) : (
          <p className="text-center text-sm text-success">Deployed {plan.deployedAt && formatDateTime(plan.deployedAt)}</p>
        )}
        <p className="text-xs italic text-muted-foreground">Planning aid — quantities should be reviewed against stock and clinical guidance before dispatch.</p>
      </CardContent>
    </Card>
  );
}
