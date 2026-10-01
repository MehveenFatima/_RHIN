import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/errors";
import { createApiRouter } from "./routes/api";
import type { LlmClient } from "./services/llm";
import type { Store } from "./store/store";

export interface AppOptions {
  store: Store;
  llm: LlmClient;
  corsOrigins?: string[];
  /** Folder containing the built frontend (vite `dist/`). Served when set and present. */
  staticDir?: string | null;
}

export function createApp({ store, llm, corsOrigins = [], staticDir = null }: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // OpenStreetMap tiles for the Leaflet map and Google Fonts for Inter.
          "img-src": ["'self'", "data:", "https://tile.openstreetmap.org"],
          // The service worker fetches (and caches) map tiles itself.
          "connect-src": ["'self'", "https://tile.openstreetmap.org"],
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
        },
      },
    }),
  );
  if (corsOrigins.length > 0) app.use("/api", cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "256kb" }));

  app.use("/api/v1", createApiRouter(store, llm));
  app.use("/api", notFound);

  const staticRoot = staticDir ? resolve(staticDir) : null;
  if (staticRoot && existsSync(staticRoot)) {
    app.use(express.static(staticRoot, { index: false, maxAge: "1h" }));
    // Single-page app: every non-API route returns index.html.
    app.get("/{*path}", (_req, res) => {
      res.sendFile(resolve(staticRoot, "index.html"));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
