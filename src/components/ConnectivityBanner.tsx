import { CloudOff, CloudUpload, RefreshCw, ServerCrash, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { cn } from "@/lib/utils";

/** Live connectivity + queue status for the field worker. */
export default function ConnectivityBanner() {
  const { online, serverReachable, queue, syncing, syncNow } = useOfflineSync();
  const pending = queue.length;

  const state = !online
    ? {
        icon: CloudOff,
        tone: "border-warning/50 bg-warning/5 text-warning",
        title: "Offline",
        detail: "Reports are saved on this device and will be sent automatically when the connection returns.",
      }
    : !serverReachable
      ? {
          icon: ServerCrash,
          tone: "border-destructive/40 bg-destructive/5 text-destructive",
          title: "Server unreachable",
          detail: "Reports are kept on this device. Retrying every 30 seconds.",
        }
      : syncing
        ? { icon: CloudUpload, tone: "border-info/40 bg-info/5 text-info", title: "Syncing…", detail: "Sending saved reports to the server." }
        : {
            icon: Wifi,
            tone: "border-success/40 bg-success/5 text-success",
            title: "Online",
            detail: pending ? "Reports waiting to be sent." : "All reports are synced.",
          };

  const Icon = state.icon;
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 sm:flex-row sm:items-center sm:justify-between", state.tone)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", syncing && "animate-pulse")} />
        <div>
          <p className="font-semibold">{state.title}</p>
          <p className="text-sm text-foreground/80">{state.detail}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          {pending} pending
        </Badge>
        <Button size="sm" variant="outline" onClick={() => void syncNow()} disabled={!online || pending === 0 || syncing}>
          <RefreshCw className={cn("mr-1 h-4 w-4", syncing && "animate-spin")} /> Sync now
        </Button>
      </div>
    </div>
  );
}
