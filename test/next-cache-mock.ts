/**
 * Test double for `next/cache`.
 *
 * It reproduces the constraint that made the blog machine API return 500 while
 * still committing its transaction: Next 16 only allows `updateTag` inside a
 * Server Action. A route handler that calls it throws — so a regression to
 * `updateTag` fails these tests instead of production.
 */

export const cacheCalls = {
  updateTag: [] as string[],
  revalidateTag: [] as Array<{ tag: string; profile?: unknown }>,
  revalidatePath: [] as string[],
};

/** Next 16: updateTag is Server-Action-only. Mirror that, loudly. */
export function updateTag(tag: string): void {
  cacheCalls.updateTag.push(tag);
  throw new Error("updateTag can only be called from within a Server Action.");
}

/** Allowed in Server Actions AND Route Handlers. */
export function revalidateTag(tag: string, profile?: unknown): void {
  cacheCalls.revalidateTag.push({ tag, profile });
}

export function revalidatePath(path: string): void {
  cacheCalls.revalidatePath.push(path);
}

/** `"use cache"` helpers — no cache exists in a plain Node test. */
export function cacheTag(...tags: string[]): void {
  void tags;
}

export function cacheLife(): void {}

export function unstable_noStore(): void {}

export function resetCacheCalls(): void {
  cacheCalls.updateTag.length = 0;
  cacheCalls.revalidateTag.length = 0;
  cacheCalls.revalidatePath.length = 0;
}
