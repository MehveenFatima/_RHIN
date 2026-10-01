import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueue, flushQueue, getQueue } from "@/lib/offlineQueue";

const sample = { patientName: "Rani Devi", age: 32, gender: "female" as const, village: "Rampur", symptom: "fever" as const };

function mockSyncResponse(handler: (ids: string[]) => { accepted: string[]; duplicates: string[] }) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const ids = (JSON.parse(String(init?.body)).reports as { id: string }[]).map((report) => report.id);
    return new Response(JSON.stringify({ ...handler(ids), alertsCreated: 0, alertsUpdated: 0, guidance: "ok" }), { status: 200 });
  });
}

describe("offline queue", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("stores reports locally with a client-generated id and timestamp", () => {
    const report = enqueue(sample);
    expect(report.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(report.recordedAt).getTime()).not.toBeNaN();
    expect(getQueue()).toEqual([report]);
  });

  it("removes accepted and duplicate reports after a sync", async () => {
    enqueue(sample);
    enqueue({ ...sample, patientName: "Mohan Lal" });
    vi.stubGlobal(
      "fetch",
      mockSyncResponse(([first, second]) => ({ accepted: [first], duplicates: [second] })),
    );

    const result = await flushQueue();
    expect(result?.accepted).toHaveLength(1);
    expect(result?.duplicates).toHaveLength(1);
    expect(getQueue()).toEqual([]);
  });

  it("keeps reports queued when the server cannot be reached", async () => {
    enqueue(sample);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(flushQueue()).rejects.toMatchObject({ status: 0 });
    expect(getQueue()).toHaveLength(1);
  });

  it("returns null when there is nothing to send", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await flushQueue()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
