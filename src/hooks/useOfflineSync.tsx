import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NewPatientReport, SyncResponse } from "@shared/types";
import { ApiError } from "@/lib/api";
import { enqueue, flushQueue, getQueue } from "@/lib/offlineQueue";

const RETRY_INTERVAL_MS = 30_000;

interface OfflineSyncState {
  /** Browser connectivity (navigator.onLine). */
  online: boolean;
  /** False when the last attempt to reach the server failed even though the browser was online. */
  serverReachable: boolean;
  queue: NewPatientReport[];
  syncing: boolean;
  lastResult: (SyncResponse & { at: string }) | null;
  lastError: string | null;
  addReport: (report: Omit<NewPatientReport, "id" | "recordedAt">) => void;
  syncNow: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncState | null>(null);

/**
 * Owns the offline report queue for the whole app: captures reports locally,
 * and replays them to the server automatically when connectivity returns
 * (the browser `online` event), on start-up, and on a retry timer.
 */
export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);
  const [queue, setQueue] = useState(getQueue);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<OfflineSyncState["lastResult"]>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const syncNow = useCallback(async () => {
    if (inFlight.current || getQueue().length === 0) return;
    inFlight.current = true;
    setSyncing(true);
    setLastError(null);
    try {
      const result = await flushQueue();
      setServerReachable(true);
      if (result) {
        setLastResult({ ...result, at: new Date().toISOString() });
        await queryClient.invalidateQueries();
      }
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) setServerReachable(false);
      setLastError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setQueue(getQueue());
      inFlight.current = false;
      setSyncing(false);
    }
  }, [queryClient]);

  const addReport = useCallback<OfflineSyncState["addReport"]>(
    (report) => {
      enqueue(report);
      setQueue(getQueue());
      if (navigator.onLine) void syncNow();
    },
    [syncNow],
  );

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void syncNow();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow]);

  // Covers "online but server unreachable" — keep retrying while reports are pending.
  useEffect(() => {
    if (!online || queue.length === 0) return;
    const timer = window.setInterval(() => void syncNow(), RETRY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [online, queue.length, syncNow]);

  const value = useMemo(
    () => ({ online, serverReachable, queue, syncing, lastResult, lastError, addReport, syncNow }),
    [online, serverReachable, queue, syncing, lastResult, lastError, addReport, syncNow],
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOfflineSync(): OfflineSyncState {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error("useOfflineSync must be used inside <OfflineSyncProvider>");
  return context;
}
