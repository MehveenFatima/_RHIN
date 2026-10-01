/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the RHIN API. Leave empty when the API serves the frontend (same origin). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
