// Test-only stand-in for the `server-only` package, which throws when
// imported outside React Server Components (including Vitest).
// Unit tests only touch pure helpers, never the DB or request scope.
export {};
