import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useCallback, useState } from "react";
import type { Symptom } from "@shared/types";
import ReportForm, { type ReportPrefill } from "@/components/asha/ReportForm";
import TriagePanel from "@/components/asha/TriagePanel";
import ConnectivityBanner from "@/components/ConnectivityBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { formatDateTime, SYMPTOM_LABELS } from "@/lib/labels";

export default function AshaWorkerView() {
  const { queue, lastResult, lastError } = useOfflineSync();
  const [prefill, setPrefill] = useState<ReportPrefill>();

  const useInReport = useCallback((symptom: Symptom, age?: number) => {
    setPrefill({ symptom, age, token: Date.now() });
    document.getElementById("patient-name")?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-6">
      <ConnectivityBanner />

      {lastError && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4" /> Last sync failed: {lastError}. Reports remain on this device.
        </p>
      )}

      {lastResult && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="space-y-2 py-4">
            <p className="flex items-center gap-2 font-medium text-success">
              <CheckCircle2 className="h-5 w-5" />
              Synced {lastResult.accepted.length} report{lastResult.accepted.length === 1 ? "" : "s"} at {formatDateTime(lastResult.at)}
              {lastResult.duplicates.length > 0 && ` (${lastResult.duplicates.length} already on server)`}
            </p>
            <p className="flex items-start gap-2 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" /> {lastResult.guidance}
            </p>
          </CardContent>
        </Card>
      )}

      <ReportForm prefill={prefill} />

      {queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Waiting to sync ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {queue.map((report) => (
                <li key={report.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-sm">
                  <span>
                    <span className="font-medium">{report.patientName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {report.age}y · {report.gender} · {report.village} · {formatDateTime(report.recordedAt)}
                    </span>
                  </span>
                  <Badge variant="outline">{SYMPTOM_LABELS[report.symptom]}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <TriagePanel onUseInReport={useInReport} />
    </div>
  );
}
