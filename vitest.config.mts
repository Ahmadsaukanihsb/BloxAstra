import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/src`,
      // Unit tests only exercise pure helpers; stub the RSC guard so those
      // modules can load in plain Node. Anything touching the DB is untested.
      "server-only": `${import.meta.dirname}/test/stub-server-only.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
