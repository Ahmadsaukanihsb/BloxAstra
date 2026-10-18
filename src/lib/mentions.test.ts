import { describe, expect, it } from "vitest";
import {
  findMentions,
  mentionQueryAt,
  mentionSuggestions,
  segmentMentions,
  type MentionTarget,
} from "@/lib/mentions";

const TOKO_RAYA: MentionTarget = { userId: "u-raya", storeName: "Toko Raya", username: "toko_raya" };
const TOKO: MentionTarget = { userId: "u-toko", storeName: "Toko", username: "toko" };
const ADM: MentionTarget = { userId: "u-adm", storeName: "Admin Astra", username: "admin" };
const DIRECTORY = [ADM, TOKO, TOKO_RAYA];

/** Rendering shorthand: `[[@Toko Raya]]` marks a recognized mention. */
function outline(body: string, directory = DIRECTORY): string {
  return segmentMentions(body, directory)
    .map((segment) => (segment.kind === "mention" ? `[[${segment.text}]]` : segment.text))
    .join("");
}

describe("segmentMentions", () => {
  it("marks a mention and leaves the surrounding prose alone", () => {
    expect(outline("halo @Toko Raya, stok masih ada?")).toBe("halo [[@Toko Raya]], stok masih ada?");
  });

  it("prefers the longest name that matches", () => {
    expect(outline("@Toko Raya kirim ya")).toBe("[[@Toko Raya]] kirim ya");
    expect(outline("@Toko kirim ya")).toBe("[[@Toko]] kirim ya");
  });

  it("resolves a mention from the username too", () => {
    expect(outline("@toko_raya halo")).toBe("[[@toko_raya]] halo");
  });

  it("does not fire on a name glued into a longer word", () => {
    expect(outline("@tokoberkah halo")).toBe("@tokoberkah halo");
    expect(findMentions("@tokoberkah halo", DIRECTORY)).toEqual([]);
  });

  it("ignores an @ glued to the word before it (email addresses)", () => {
    expect(outline("kirim ke rian@Toko.id ya")).toBe("kirim ke rian@Toko.id ya");
    expect(findMentions("rian@toko.id", DIRECTORY)).toEqual([]);
  });

  it("accepts a mention hugging punctuation or the edges of the message", () => {
    expect(outline("@Toko!")).toBe("[[@Toko]]!");
    expect(outline("(@Toko)")).toBe("([[@Toko]])");
    expect(outline("@Toko")).toBe("[[@Toko]]");
  });

  it("returns one text segment when nothing matches, even without an @", () => {
    expect(segmentMentions("tidak ada mention", [])).toEqual([
      { kind: "text", text: "tidak ada mention" },
    ]);
    expect(segmentMentions("tidak ada mention", DIRECTORY)).toEqual([
      { kind: "text", text: "tidak ada mention" },
    ]);
  });
});

describe("findMentions", () => {
  it("lists each called-out seller once, in order of appearance", () => {
    expect(findMentions("@Toko Raya @Admin Astra @toko raya", DIRECTORY)).toEqual([
      TOKO_RAYA,
      ADM,
    ]);
  });

  it("lists nobody for an empty message", () => {
    expect(findMentions("", DIRECTORY)).toEqual([]);
  });
});

describe("mentionQueryAt", () => {
  it("reads the half-typed name behind the caret", () => {
    expect(mentionQueryAt("halo @tok", 9)).toEqual({ at: 5, query: "tok" });
    expect(mentionQueryAt("@", 1)).toEqual({ at: 0, query: "" });
  });

  it("only looks behind the caret", () => {
    expect(mentionQueryAt("@toko halo", 5)).toEqual({ at: 0, query: "toko" });
  });

  it("closes on a space, so a picked shop name ends the search", () => {
    expect(mentionQueryAt("@Toko Raya ", 11)).toBeNull();
  });

  it("ignores an @ glued to a word and text with no @ at all", () => {
    expect(mentionQueryAt("rian@tok", 8)).toBeNull();
    expect(mentionQueryAt("hai semua", 9)).toBeNull();
  });
});

describe("mentionSuggestions", () => {
  it("offers the directory from the top for a bare @", () => {
    expect(mentionSuggestions(DIRECTORY, "")).toEqual([ADM, TOKO, TOKO_RAYA]);
  });

  it("matches a prefix of the shop name case-insensitively", () => {
    expect(mentionSuggestions(DIRECTORY, "toko r")).toEqual([TOKO_RAYA]);
  });

  it("matches a prefix of the username", () => {
    expect(mentionSuggestions(DIRECTORY, "adm")).toEqual([ADM]);
  });

  it("honours the limit and gives up on nonsense", () => {
    expect(mentionSuggestions(DIRECTORY, "", 2)).toEqual([ADM, TOKO]);
    expect(mentionSuggestions(DIRECTORY, "zzz")).toEqual([]);
  });
});
