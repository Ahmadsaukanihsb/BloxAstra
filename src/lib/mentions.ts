/**
 * `@nama-toko` in the seller group room.
 *
 * Shop names are free text and routinely contain spaces ("Toko Robux Jaya"),
 * so a mention is not one token: at every `@` the longest known name that
 * matches at that spot and ends on a boundary wins. Two rules keep it honest —
 * a name glued into a longer word is not a mention ("@tokoberkah" against a shop
 * called "Toko"), and an `@` glued to the word before it is ignored (email
 * addresses like `rian@tokoku.id` must never page anybody).
 *
 * The module is deliberately pure: the room renders recognition on the client
 * with the same function the server uses to decide who gets a notification, so
 * what a reader sees highlighted is exactly what was delivered.
 */

export interface MentionTarget {
  userId: string;
  /** Shop name — what the composer inserts and the reader sees. */
  storeName: string | null;
  username: string;
}

export type MentionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; target: MentionTarget };

/** Letters, digits and underscore — the characters that can extend a word. */
const WORD = /[\p{L}\p{N}_]/u;

interface Needle {
  needle: string;
  target: MentionTarget;
}

/**
 * Every name a message may call out, longest first so "Toko Raya" wins over a
 * shorter shop called "Toko". A target answers to both its shop name and its
 * username, but never twice under the same spelling.
 */
function needlesFor(directory: MentionTarget[]): Needle[] {
  const taken = new Set<string>();
  const needles: Needle[] = [];
  for (const target of directory) {
    for (const raw of [target.storeName, target.username]) {
      const needle = raw?.trim();
      if (!needle) continue;
      const key = needle.toLowerCase();
      if (taken.has(key)) continue;
      taken.add(key);
      needles.push({ needle, target });
    }
  }
  return needles.sort((a, b) => b.needle.length - a.needle.length);
}

/** The needle that starts exactly at `from` and stops on a word boundary. */
function matchAt(body: string, from: number, needles: Needle[]): Needle | null {
  for (const candidate of needles) {
    const end = from + candidate.needle.length;
    if (end > body.length) continue;
    if (body.slice(from, end).toLowerCase() !== candidate.needle.toLowerCase()) continue;
    if (end < body.length && WORD.test(body[end])) continue;
    return candidate;
  }
  return null;
}

/** Split a message into plain text and recognized mentions, in reading order. */
export function segmentMentions(body: string, directory: MentionTarget[]): MentionSegment[] {
  if (directory.length === 0 || !body.includes("@")) return [{ kind: "text", text: body }];

  const needles = needlesFor(directory);
  const segments: MentionSegment[] = [];
  let textFrom = 0;
  let index = 0;

  while (index < body.length) {
    if (body[index] !== "@" || (index > 0 && WORD.test(body[index - 1]))) {
      index += 1;
      continue;
    }
    const match = matchAt(body, index + 1, needles);
    if (!match) {
      index += 1;
      continue;
    }
    const end = index + 1 + match.needle.length;
    if (index > textFrom) segments.push({ kind: "text", text: body.slice(textFrom, index) });
    segments.push({ kind: "mention", text: body.slice(index, end), target: match.target });
    textFrom = end;
    index = end;
  }

  if (textFrom < body.length) segments.push({ kind: "text", text: body.slice(textFrom) });
  return segments.length > 0 ? segments : [{ kind: "text", text: body }];
}

/** Who a message called out — one entry per seller, in order of appearance. */
export function findMentions(body: string, directory: MentionTarget[]): MentionTarget[] {
  const found: MentionTarget[] = [];
  const seen = new Set<string>();
  for (const segment of segmentMentions(body, directory)) {
    if (segment.kind !== "mention" || seen.has(segment.target.userId)) continue;
    seen.add(segment.target.userId);
    found.push(segment.target);
  }
  return found;
}

export interface MentionQuery {
  /** Index of the `@` this query hangs off. */
  at: number;
  /** What has been typed after it, without the `@`. */
  query: string;
}

/**
 * The `@` the caret is typing after, if any — what the composer's menu filters
 * on. A blank ends the search: shop names contain spaces, but they arrive from
 * the menu, never by typing the space yourself. An `@` glued to the word before
 * it starts nothing, so an email address never opens the menu.
 */
export function mentionQueryAt(value: string, caret: number): MentionQuery | null {
  const upto = value.slice(0, Math.max(0, caret));
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && WORD.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { at, query };
}

/**
 * Composer suggestions for the text typed after `@`. Prefix match on the shop
 * name or the username; an empty query (a bare `@`) offers the directory from
 * the top, which is also what a seller sees before they know any shop names.
 */
export function mentionSuggestions(
  directory: MentionTarget[],
  query: string,
  limit = 6,
): MentionTarget[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return directory.slice(0, limit);
  return directory
    .filter((target) => {
      const store = target.storeName?.toLowerCase() ?? "";
      return store.startsWith(needle) || target.username.toLowerCase().startsWith(needle);
    })
    .slice(0, limit);
}
