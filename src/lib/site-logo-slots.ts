/**
 * Client-safe logo constants. Kept apart from `site-logo.ts` (which opens
 * the database) so the admin editor can import the budget without pulling
 * server-only modules into the client bundle.
 */

export const SITE_LOGO_KEY = "site.logo";

/**
 * Served on every page load through the layout, so the budget is tighter
 * than dispute evidence (1.5MB): 500KB keeps the header cheap. The picker
 * enforces the same ceiling client-side before upload.
 */
export const SITE_LOGO_MAX_BYTES = 500_000;
