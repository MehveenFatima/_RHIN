import { expect, test, type Page } from "@playwright/test";

// Tests share one server and run in order: field report → district dispatch → state plan.
test.describe.configure({ mode: "serial" });

const QUEUE_KEY = "rhin.offlineQueue.v1";

async function totalReports(page: Page): Promise<number> {
  const response = await page.request.get("/api/v1/analytics/stats");
  return (await response.json()).totalReports;
}

async function choose(page: Page, label: string, option: RegExp) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

test("ASHA worker: a report captured offline is replayed when the connection returns", async ({ page, context }) => {
  await page.goto("/asha");
  await expect(page.getByText("Add patient report")).toBeVisible();
  // Wait for the service worker so the app shell is cached before going offline.
  await page.evaluate(() => navigator.serviceWorker.ready);
  const before = await totalReports(page);

  await context.setOffline(true);
  await page.getByPlaceholder("Full name").fill("Test Patient");
  await page.getByPlaceholder("0–120").fill("34");
  await choose(page, "Gender", /female/i);
  await choose(page, "Village", /Devpur/);
  await choose(page, "Main symptom", /fever/i);
  await page.getByRole("button", { name: /Save report/ }).click();

  // Queued on the device, not on the server.
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) ?? "", QUEUE_KEY)).toContain("Test Patient");
  expect(await totalReports(page)).toBe(before);

  // The app shell still loads with no network (service worker).
  await page.reload();
  await expect(page.getByText("Rural Health Intelligence Network").first()).toBeVisible();

  // Reconnect: the `online` event replays the queue without any click.
  await context.setOffline(false);
  await expect.poll(() => totalReports(page), { timeout: 15_000 }).toBe(before + 1);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) ?? "[]", QUEUE_KEY)).toBe("[]");
});

test("ASHA worker: triage without a Groq key falls back to rules and says so", async ({ page }) => {
  await page.goto("/asha");
  await page.getByRole("button", { name: "Fever", exact: true }).click();
  await page.getByRole("button", { name: "Rash", exact: true }).click();
  await page.getByPlaceholder(/fever for 3 days/).fill("joint pain and headache for 3 days");
  await page.getByRole("button", { name: /Analyse/ }).click();

  await expect(page.getByText("Recommended actions")).toBeVisible();
  await expect(page.getByText(/Rule-based/).first()).toBeVisible();
});

test("District officer: alerts appear on the Leaflet map and a pre-filled brief dispatches a team", async ({ page }) => {
  await page.goto("/district");
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(8);

  await page.getByRole("button", { name: /Deploy medical team/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Medicines to carry/i).first()).toBeVisible();
  await expect(dialog.getByText(/Assembly point/i).first()).toBeVisible();
  await dialog.getByRole("button", { name: /send|deploy/i }).last().click();

  await expect
    .poll(async () => {
      const alerts = (await (await page.request.get("/api/v1/alerts")).json()) as { status: string }[];
      return alerts.some((alert) => alert.status === "in-progress");
    })
    .toBe(true);
});

test("State officer: trend charts render and a resource plan can be generated and deployed", async ({ page }) => {
  await page.goto("/state");
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  await page.getByRole("button", { name: /Generate resource plan/ }).first().click();
  await expect(page.getByText(/Doctors/).first()).toBeVisible();
  await page.getByRole("button", { name: /deploy resources/i }).first().click();

  await expect
    .poll(async () => {
      const plans = (await (await page.request.get("/api/v1/plans")).json()) as { status: string }[];
      return plans.some((plan) => plan.status === "deployed");
    })
    .toBe(true);
});
