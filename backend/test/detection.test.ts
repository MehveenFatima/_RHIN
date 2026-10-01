import { describe, expect, it } from "vitest";
import type { OutbreakAlert, PatientReport, Symptom } from "../../shared/types";
import { countClusters, detectOutbreaks, severityFor, surveillanceGuidance } from "../src/domain/detection";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

let counter = 0;
function reports(village: string, symptom: Symptom, count: number, hoursBack = 2): PatientReport[] {
  return Array.from({ length: count }, () => ({
    id: `r-${++counter}`,
    patientName: "Test Patient",
    age: 30,
    gender: "female" as const,
    village,
    symptom,
    recordedAt: hoursAgo(hoursBack),
  }));
}

const ids = () => {
  let n = 0;
  return () => `alert-${++n}`;
};

describe("severityFor", () => {
  it("maps case counts to severity using per-syndrome thresholds", () => {
    expect(severityFor("fever", 5)).toBe("low");
    expect(severityFor("fever", 7)).toBe("medium");
    expect(severityFor("fever", 10)).toBe("high");
    // rash has lower thresholds
    expect(severityFor("rash", 5)).toBe("medium");
    expect(severityFor("rash", 8)).toBe("high");
  });
});

describe("detectOutbreaks", () => {
  it("does not raise an alert below the threshold", () => {
    const result = detectOutbreaks(reports("Rampur", "fever", 4), [], NOW, ids());
    expect(result.created).toHaveLength(0);
  });

  it("raises one alert per village + symptom cluster at the threshold", () => {
    const input = [...reports("Rampur", "fever", 5), ...reports("Rampur", "cough", 2), ...reports("Devpur", "rash", 3)];
    const result = detectOutbreaks(input, [], NOW, ids());

    expect(result.created.map((alert) => [alert.village, alert.symptom, alert.caseCount])).toEqual([
      ["Rampur", "fever", 5],
      ["Devpur", "rash", 3],
    ]);
    expect(result.created.every((alert) => alert.status === "active")).toBe(true);
  });

  it("ignores reports outside the 7-day window", () => {
    const old = reports("Rampur", "fever", 5, 24 * 8);
    expect(detectOutbreaks(old, [], NOW, ids()).created).toHaveLength(0);
  });

  it("updates an open alert instead of duplicating it and escalates at high severity", () => {
    const first = detectOutbreaks(reports("Rampur", "fever", 5), [], NOW, ids());
    const allReports = [...reports("Rampur", "fever", 5), ...reports("Rampur", "fever", 5)];
    const second = detectOutbreaks(allReports, first.alerts, NOW, ids());

    expect(second.created).toHaveLength(0);
    expect(second.updated).toHaveLength(1);
    const [alert] = second.alerts;
    expect(alert.caseCount).toBe(10);
    expect(alert.severity).toBe("high");
    expect(alert.escalated).toBe(true);
    expect(alert.escalationReason).toMatch(/Automatically escalated/);
  });

  it("never downgrades severity while an alert is open", () => {
    const open: OutbreakAlert = {
      id: "a1",
      village: "Rampur",
      symptom: "fever",
      caseCount: 10,
      severity: "high",
      status: "in-progress",
      escalated: true,
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(10),
    };
    const result = detectOutbreaks(reports("Rampur", "fever", 6), [open], NOW, ids());
    expect(result.alerts[0].caseCount).toBe(6);
    expect(result.alerts[0].severity).toBe("high");
  });

  it("does not re-raise a resolved outbreak from reports recorded before resolution", () => {
    const resolved: OutbreakAlert = {
      id: "a1",
      village: "Rampur",
      symptom: "fever",
      caseCount: 5,
      severity: "low",
      status: "resolved",
      escalated: false,
      createdAt: hoursAgo(20),
      updatedAt: hoursAgo(1),
      resolvedAt: hoursAgo(1),
    };
    const before = reports("Rampur", "fever", 5, 3);
    expect(detectOutbreaks(before, [resolved], NOW, ids()).created).toHaveLength(0);

    const after = reports("Rampur", "fever", 5, 0.5);
    expect(detectOutbreaks([...before, ...after], [resolved], NOW, ids()).created).toHaveLength(1);
  });
});

describe("countClusters and guidance", () => {
  it("sorts clusters by size", () => {
    const clusters = countClusters([...reports("A", "cough", 1), ...reports("B", "fever", 3)], [], NOW);
    expect(clusters[0]).toMatchObject({ village: "B", symptom: "fever", count: 3 });
  });

  it("tells the worker when a village is approaching a threshold", () => {
    expect(surveillanceGuidance(reports("Rampur", "fever", 3), [], NOW)).toMatch(/approaching the alert threshold/);
    expect(surveillanceGuidance(reports("Rampur", "fever", 6), [], NOW)).toMatch(/district team has been alerted/);
  });

  it("focuses guidance on the clusters of the reports just synced", () => {
    const all = [...reports("Rampur", "fever", 9), ...reports("Devpur", "cough", 1)];
    const guidance = surveillanceGuidance(all, [], NOW, [{ village: "Devpur", symptom: "cough" }]);
    expect(guidance).not.toMatch(/Rampur/);
    expect(guidance).toMatch(/No village is near an alert threshold/);
  });
});
