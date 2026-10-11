import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Build output must never be linted. Flat config does not ignore dot-directories
// by default, and next.config.ts honours NEXT_DIST_DIR so a verification build
// (see the deploy checklist) writes to a second dist dir beside the live one.
// Ignore both patterns rather than just the one that happens to be active.
const buildOutputs = [".next*/**"];
const distDir = process.env.NEXT_DIST_DIR?.trim();
if (distDir && !distDir.startsWith(".next")) buildOutputs.push(`${distDir}/**`);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ...buildOutputs,
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
