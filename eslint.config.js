import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const unusedVars = ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }];

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "backend/dist", "backend/data", "test-results", "playwright-report", "**/node_modules"] },
  {
    // Frontend (React, browser)
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": unusedVars,
    },
  },
  {
    // shadcn/ui primitives export variants alongside components by design.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Backend, shared types and tooling config (Node)
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["backend/**/*.ts", "shared/**/*.ts", "e2e/**/*.ts", "*.config.{js,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVars,
    },
  },
);
