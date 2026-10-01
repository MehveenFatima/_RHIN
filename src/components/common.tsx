import type { LucideIcon } from "lucide-react";
import { Bot, ListChecks } from "lucide-react";
import type { AlertStatus, ResultSource, Severity } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SEVERITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-destructive text-destructive-foreground hover:bg-destructive",
  medium: "bg-warning text-warning-foreground hover:bg-warning",
  low: "bg-info text-info-foreground hover:bg-info",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge className={SEVERITY_STYLES[severity]}>{SEVERITY_LABELS[severity].toUpperCase()}</Badge>;
}

const STATUS_STYLES: Record<AlertStatus, string> = {
  active: "border-destructive/50 text-destructive",
  "in-progress": "border-warning/60 text-warning",
  resolved: "border-success/50 text-success",
};

export function StatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** Makes it explicit whether a result came from the LLM or the rule-based fallback. */
export function SourceBadge({ source, model, fallbackReason }: { source: ResultSource; model?: string; fallbackReason?: string }) {
  if (source === "llm") {
    return (
      <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
        <Bot className="h-3 w-3" /> AI · {model ?? "LLM"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-muted-foreground/40 text-muted-foreground" title={fallbackReason}>
      <ListChecks className="h-3 w-3" /> Rule-based{fallbackReason ? ` · ${fallbackReason}` : ""}
    </Badge>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "text-primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string | undefined;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="rounded-lg bg-muted p-2">
          <Icon className={cn("h-5 w-5", tone)} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function QueryError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {error instanceof Error ? error.message : "Something went wrong"} — showing the last data received.
    </p>
  );
}
