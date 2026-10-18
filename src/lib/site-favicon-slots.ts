/**
 * Client-safe favicon constants. Kept apart from `site-favicon.ts` (which opens
 * the database) so the admin editor can import the budget without pulling
 * server-only modules into the client bundle.
 */

export const SITE_FAVICON_KEY = "site.favicon";

/**
 * Tighter than the header logo (500KB): a favicon is fetched on essentially
 * every navigation and is a tiny mark by nature. 200KB is generous for a
 * 180×180 PNG and keeps a data URL in the document head small.
 */
export const SITE_FAVICON_MAX_BYTES = 200_000;
