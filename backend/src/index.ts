import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createGroqClient } from "./services/llm";
import { seedDemoData } from "./store/seed";
import { Store } from "./store/store";

async function main() {
  const config = loadConfig();
  const store = await Store.open(config.dataFile);
  if (config.seedDemoData) await seedDemoData(store);

  const llm = createGroqClient(config.groq);
  const app = createApp({ store, llm, corsOrigins: config.corsOrigins, staticDir: config.staticDir });

  app.listen(config.port, () => {
    console.log(`[rhin] API listening on http://localhost:${config.port}/api/v1`);
    console.log(`[rhin] data file: ${config.dataFile ?? "(in-memory)"}`);
    console.log(
      `[rhin] AI: ${llm.configured ? `Groq (${llm.model})` : "GROQ_API_KEY not set — using rule-based fallback"}`,
    );
    if (config.staticDir && existsSync(config.staticDir)) {
      console.log(`[rhin] serving frontend from ${resolve(config.staticDir)}`);
    }
  });
}

main().catch((error) => {
  console.error("[rhin] failed to start", error);
  process.exit(1);
});
