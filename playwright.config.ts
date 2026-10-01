import { defineConfig, devices } from "@playwright/test";

const PORT = 5077;

/**
 * End-to-end tests run against the production build: Express serves the built
 * React app and the API on one port, exactly as in deployment.
 * GROQ_API_KEY is forced empty so AI features use the deterministic rule-based fallback.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    // Optional: point at a pre-installed Chromium instead of `npx playwright install`.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npm run build:all && npm start",
    url: `http://localhost:${PORT}/api/v1/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      DATA_FILE: "", // in-memory store: every run starts from the demo seed
      SEED_DEMO_DATA: "true",
      GROQ_API_KEY: "",
    },
  },
});
