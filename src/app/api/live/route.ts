import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { subscribeLive, type LiveEvent, type LiveTopic } from "@/lib/live-bus";
import { joinPresence, leavePresence, touchPresence } from "@/lib/presence";

/**
 * Server-Sent Events channel: the push half of the live UI.
 *
 * Every payload is empty on purpose — an event only says "the inbox" or "the
 * seller room" changed, and the client refetches through the normal read path.
 * That keeps one source of truth, makes the stream impossible to trust into
 * stale data, and means a dropped event is never a lost notification.
 *
 * Two details keep the connection usable through the Cloudflare Tunnel:
 * a `retry:` hint so a dropped stream reconnects in seconds, and a heartbeat
 * comment every 20s so no intermediary closes an idle connection.
 */
const HEARTBEAT_MS = 20_000;

const TOPICS: LiveTopic[] = ["inbox", "chat", "presence"];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const audiences = new Set<string>([`user:${user.id}`]);
  // The name this connection shows as in the room's "who is online" strip.
  // Null for anyone who cannot post there — a buyer browsing the catalogue must
  // not appear in the seller room's presence list.
  let presenceName: string | null = null;
  if (user.role === "seller" || user.role === "admin") {
    audiences.add("sellers");
    const profile = await db.sellerProfile.findUnique({
      where: { userId: user.id },
      select: { storeName: true },
    });
    presenceName = profile?.storeName ?? user.username;
  } else {
    // Posting in the seller room needs a verified profile, so a buyer who
    // somehow has one still gets live updates without broadcasting to buyers.
    const profile = await db.sellerProfile.findUnique({
      where: { userId: user.id },
      select: { kycVerified: true, storeName: true },
    });
    if (profile?.kycVerified) {
      audiences.add("sellers");
      presenceName = profile.storeName;
    }
  }

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsubscribe?.();
    unsubscribe = null;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    if (presenceName) leavePresence(user.id);
    request.signal.removeEventListener("abort", cleanup);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client vanished mid-write; treat it as a disconnect.
          cleanup();
        }
      };

      send("retry: 3000\n\n");
      send(`event: ready\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);

      unsubscribe = subscribeLive((event: LiveEvent) => {
        if (!audiences.has(event.audience)) return;
        send(`event: ${event.topic}\ndata: ${JSON.stringify({ seq: event.seq, at: event.at })}\n\n`);
      });

      heartbeat = setInterval(() => {
        if (presenceName) touchPresence(user.id);
        send(`: ping ${Date.now()}\n\n`);
      }, HEARTBEAT_MS);
      request.signal.addEventListener("abort", cleanup);
      // An open stream *is* presence: joined here, refreshed by the heartbeat
      // above, and dropped when the stream goes away.
      if (presenceName) joinPresence(user.id, presenceName);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // `no-transform` stops intermediaries from buffering the stream, and
      // `no-store` because a personalized stream must never be cached.
      "Cache-Control": "no-store, no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // Which topics this connection carries, for anyone reading the network tab.
      "X-Live-Topics": TOPICS.join(","),
    },
  });
}
