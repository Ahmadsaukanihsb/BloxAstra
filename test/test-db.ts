import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A throwaway SQLite database for integration tests.
 *
 * `prisma db push` builds it from `prisma/schema.prisma`, so the test DB can
 * never drift from the client the app actually uses (copying a checked-in DB
 * would). The schema URL is passed through the child's env only: the Prisma CLI
 * logs that it loaded `.env`, but an already-set variable wins, so the developer
 * database is never touched.
 *
 * Call this BEFORE importing `@/lib/db` — the PrismaClient reads
 * DATABASE_URL when the module is first evaluated.
 */
export interface TestDatabase {
  url: string;
  /** Remove the temp directory. Disconnect Prisma first (Windows locks files). */
  cleanup: () => void;
}

export function createTestDatabase(): TestDatabase {
  const dir = mkdtempSync(path.join(tmpdir(), "bloxastra-it-"));
  const file = path.join(dir, "test.db");
  // Prisma wants a file: URL with forward slashes, even on Windows.
  const url = `file:${file.split(path.sep).join("/")}`;

  execFileSync(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--skip-generate",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    },
  );

  process.env.DATABASE_URL = url;

  return {
    url,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
