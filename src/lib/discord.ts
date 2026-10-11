import "server-only";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

const TIMEOUT_MS = 8_000;
const MAX_URL_LENGTH = 500;

/**
 * Seller-owned Discord webhooks for the pool race.
 *
 * Each seller pastes their own channel webhook URL in the dashboard. When a
 * pool order flips to paid, we fan out one embed per configured seller.
 * Dispatch is strictly fire-and-forget: a dead/slow webhook only writes a
 * log line and can never fail the payment that triggered it.
 */

export interface PoolAlertOrder {
  code: string;
  kind: string;
  kindLabel: string;
  robuxAmount: number | null;
  total: number;
}

const ROBUX_KIND_LABELS: Record<string, string> = {
  robux_username: "Robux via Username",
  robux_login: "Robux via Login",
  robux_gamepass: "Robux via Gamepass",
  premium: "Roblox Premium",
};

/** Human label for a pool order kind (single source of truth). */
export function poolKindLabel(kind: string): string {
  return ROBUX_KIND_LABELS[kind] ?? "Order Robux";
}

/** True when the string looks like a real Discord channel webhook URL. */
export function validDiscordWebhookUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.hostname !== "discord.com" && url.hostname !== "discordapp.com") return false;
  // /api/webhooks/{id}/{token}, optional ?thread_id=... query preserved.
  if (!/^\/api\/webhooks\/\d+\/[\w-]+$/.test(url.pathname)) return false;
  return true;
}

/** Mask for display: https://discord.com/api/webhooks/…a1b2c3d4 */
export function maskWebhookUrl(url: string): string {
  const tail = url.trim().slice(-8);
  return `https://discord.com/api/webhooks/…${tail}`;
}

function poolEmbed(order: PoolAlertOrder) {
  return {
    content: null as string | null,
    embeds: [
      {
        title: "⚡ Order pool baru — siapa cepat dia dapat!",
        description: `Order **${order.code}** baru saja lunas dan masuk papan rebutan.`,
        color: 0xe11d48,
        fields: [
          { name: "Jenis", value: order.kindLabel, inline: true },
          {
            name: "Robux",
            value: order.robuxAmount ? `${order.robuxAmount.toLocaleString("id-ID")} R$` : "Premium",
            inline: true,
          },
          {
            name: "Total",
            value: `Rp${order.total.toLocaleString("id-ID")}`,
            inline: true,
          },
        ],
        footer: { text: "Blox Astra • Pool Rebutan" },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Buka papan rebutan",
            url: absoluteUrl("/dashboard/penjual/order-robux"),
          },
        ],
      },
    ],
  };
}

/** POST one embed. Resolves false (never throws) on any failure. */
export async function sendDiscordPoolAlert(
  webhookUrl: string,
  order: PoolAlertOrder,
): Promise<boolean> {  if (!validDiscordWebhookUrl(webhookUrl)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(poolEmbed(order)),
      signal: controller.signal,
    });
    // Discord answers 200/204 on success; 404/401 = deleted/revoked webhook.
    if (!response.ok) {
      console.error("discord pool alert failed", response.status, order.code);
      return false;
    }
    return true;
  } catch (error) {
    console.error("discord pool alert failed", order.code, error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface BroadcastResult {
  attempted: number;
  delivered: number;
}

/**
 * Fan out a pool alert to every verified seller with an enabled webhook.
 * Fire-and-forget: awaits settlement of the POSTs but never throws, so
 * callers can `void` it straight after flipping an order to paid.
 */
export async function broadcastPoolOrder(order: PoolAlertOrder): Promise<BroadcastResult> {  try {
    const sellers = await db.sellerProfile.findMany({
      where: {
        kycVerified: true,
        discordWebhookEnabled: true,
        discordWebhookUrl: { not: null },
      },
      select: { discordWebhookUrl: true },
    });
    const urls = sellers
      .map((row) => row.discordWebhookUrl)
      .filter((url): url is string => Boolean(url));
    if (urls.length === 0) return { attempted: 0, delivered: 0 };
    const results = await Promise.allSettled(
      urls.map((url) => sendDiscordPoolAlert(url, order)),
    );
    return {
      attempted: urls.length,
      delivered: results.filter(
        (result) => result.status === "fulfilled" && result.value,
      ).length,
    };
  } catch (error) {
    console.error("discord pool broadcast failed", order.code, error);
    return { attempted: 0, delivered: 0 };
  }
}

/** Test ping: proves the seller's URL works without faking an order. */
export async function sendDiscordTestPing(webhookUrl: string, storeName: string): Promise<boolean> {
  if (!validDiscordWebhookUrl(webhookUrl)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "✅ Webhook Blox Astra terhubung",
            description: `Halo **${storeName}**! Mulai sekarang setiap order pool yang lunas masuk ke channel ini. Siapa cepat dia dapat.`,
            color: 0x16a34a,
            footer: { text: "Blox Astra • Pool Rebutan" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("discord test ping failed", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("discord test ping failed", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
