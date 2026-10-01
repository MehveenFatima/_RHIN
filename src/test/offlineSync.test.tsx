import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineSyncProvider, useOfflineSync } from "@/hooks/useOfflineSync";

const sample = { patientName: "Rani Devi", age: 32, gender: "female" as const, village: "Rampur", symptom: "fever" as const };

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <OfflineSyncProvider>{children}</OfflineSyncProvider>
    </QueryClientProvider>
  );
}

describe("OfflineSyncProvider", () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const ids = (JSON.parse(String(init?.body)).reports as { id: string }[]).map((report) => report.id);
    return new Response(JSON.stringify({ accepted: ids, duplicates: [], alertsCreated: 0, alertsUpdated: 0, guidance: "All good" }), {
      status: 200,
    });
  });

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setOnline(true);
  });

  it("queues reports while offline and replays them when the connection returns", async () => {
    setOnline(false);
    const { result } = renderHook(() => useOfflineSync(), { wrapper });

    act(() => result.current.addReport(sample));
    act(() => result.current.addReport({ ...sample, patientName: "Mohan Lal" }));

    expect(result.current.online).toBe(false);
    expect(result.current.queue).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(result.current.queue).toHaveLength(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/reports\/sync$/);
    expect(result.current.lastResult?.accepted).toHaveLength(2);
    expect(result.current.lastResult?.guidance).toBe("All good");
  });

  it("sends a report immediately when online", async () => {
    setOnline(true);
    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    act(() => result.current.addReport(sample));
    await waitFor(() => expect(result.current.queue).toHaveLength(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks the server unreachable and keeps the queue when sync fails", async () => {
    setOnline(true);
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { result } = renderHook(() => useOfflineSync(), { wrapper });
    act(() => result.current.addReport(sample));

    await waitFor(() => expect(result.current.serverReachable).toBe(false));
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.lastError).toMatch(/Cannot reach/);
  });
});
