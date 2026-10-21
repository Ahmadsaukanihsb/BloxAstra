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
    // Unit tests live beside their module; integration tests live in test/ and
    // own a temporary SQLite database (see test/test-db.ts).
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Each integration file sets DATABASE_URL for its own temp database.
    // Separate processes keep that env (and the Prisma client) file-local.
    pool: "forks",
    // `prisma db push` plus a cold Prisma engine take a moment on Windows.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
