import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { createTestDatabase, type TestDatabase } from "./test-db";

// Same constraint the blog route hit: the payment state machine calls
// revalidateTag, which is legal here; updateTag would not be.
vi.mock("next/cache", async () => await import("./next-cache-mock"));

type Payments = typeof import("@/lib/payments");
type TripayWebhook = typeof import("@/app/api/payments/tripay/route");

const TRIPAY_PRIVATE_KEY = "it-tripay-private-key";
const TOTAL = 16_500;

let database: TestDatabase;
let db: PrismaClient;
let applyPaymentNotification: Payments["applyPaymentNotification"];
let tripayPOST: TripayWebhook["POST"];

let buyerId: string;
let sellerId: string;
let productId: string;
let orderSeq = 0;

async function createOrder(
  options: {
    status?: string;
    paymentStatus?: string;
    withProduct?: boolean;
    withPromo?: boolean;
  } = {},
) {
  orderSeq += 1;
  const code = `BX-IT${String(orderSeq).padStart(3, "0")}`;

  return db.order.create({
    data: {
      code,
      kind: "catalog",
      status: options.status ?? "pending_payment",
      buyerId,
      productId: options.withProduct ? productId : null,
      sellerId,
      quantity: 1,
      unitPrice: 15_000,
      platformFee: 1_500,
      total: TOTAL,
      promoCode: options.withPromo ? "HEMAT" : null,
      payment: {
        create: {
          provider: "tripay",
          amount: TOTAL,
          status: options.paymentStatus ?? "pending",
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      },
    },
    include: { payment: true },
  });
}

function settle(orderCode: string, overrides: Partial<{ status: string; fraudStatus: string; grossAmount: number }> = {}) {
  return applyPaymentNotification({
    orderCode,
    status: overrides.status ?? "settlement",
    fraudStatus: overrides.fraudStatus,
    grossAmount: overrides.grossAmount ?? TOTAL,
    raw: { source: "integration-test" },
  });
}

beforeAll(async () => {
  database = createTestDatabase();
  ({ db } = await import("@/lib/db"));
  ({ applyPaymentNotification } = await import("@/lib/payments"));
  ({ POST: tripayPOST } = await import("@/app/api/payments/tripay/route"));

  process.env.TRIPAY_PRIVATE_KEY = TRIPAY_PRIVATE_KEY;
  process.env.TRIPAY_API_KEY = "it-tripay-api-key";
  process.env.TRIPAY_MERCHANT_CODE = "T0001";
  process.env.TRIPAY_IS_PRODUCTION = "false";

  const buyer = await db.user.create({
    data: { email: "buyer@it.local", username: "buyer_it", role: "buyer" },
  });
  buyerId = buyer.id;

  const sellerUser = await db.user.create({
    data: { email: "seller@it.local", username: "seller_it", role: "seller" },
  });
  await db.category.create({
    data: {
      slug: "gamepass",
      name: "Gamepass",
      tagline: "Item dalam game",
      fulfillment: "manual",
      slaMinutes: 15,
      commissionPercent: 10,
    },
  });
  const seller = await db.sellerProfile.create({
    data: {
      userId: sellerUser.id,
      storeName: "Toko Uji",
      handle: "toko-uji",
      city: "Jakarta",
      bio: "Toko untuk pengujian.",
      kycVerified: true,
    },
  });
  sellerId = seller.id;

  const product = await db.product.create({
    data: {
      slug: "robux-100",
      title: "100 Robux",
      categorySlug: "gamepass",
      game: "Roblox",
      price: 15_000,
      stock: 5,
      deliveryKind: "manual",
      sellerId: seller.id,
      description: "Paket uji.",
      highlights: "[]",
    },
  });
  productId = product.id;

  await db.promoCode.create({
    data: { code: "HEMAT", type: "fixed", value: 1_000, maxUses: 10, usedCount: 3 },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await db.$disconnect();
  delete process.env.TRIPAY_PRIVATE_KEY;
  delete process.env.TRIPAY_API_KEY;
  delete process.env.TRIPAY_MERCHANT_CODE;
  delete process.env.TRIPAY_IS_PRODUCTION;
  database.cleanup();
});

describe("applyPaymentNotification", () => {
  it("settles a pending order exactly once and starts the confirm window", async () => {
    const order = await createOrder();

    await expect(settle(order.code)).resolves.toEqual({ ok: true });

    const fresh = await db.order.findUnique({
      where: { id: order.id },
      include: { payment: true, events: true },
    });
    expect(fresh?.status).toBe("paid");
    expect(fresh?.payment?.status).toBe("settled");
    expect(fresh?.autoReleaseAt).toBeInstanceOf(Date);
    expect(fresh?.events.filter((event) => event.state === "paid")).toHaveLength(1);
    expect(
      await db.notification.count({ where: { userId: buyerId, kind: "order_paid" } }),
    ).toBeGreaterThan(0);
  });

  it("treats a replayed settlement as already processed (no second event)", async () => {
    const order = await createOrder();
    await settle(order.code);

    await expect(settle(order.code)).resolves.toEqual({ ok: true, alreadyProcessed: true });

    const events = await db.orderEvent.findMany({ where: { orderId: order.id, state: "paid" } });
    expect(events).toHaveLength(1);
  });

  it("rejects a notification whose amount does not match the invoice", async () => {
    const order = await createOrder();

    const result = await settle(order.code, { grossAmount: TOTAL - 1 });

    expect(result).toEqual({ ok: false, reason: "amount_mismatch" });
    const fresh = await db.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(fresh?.status).toBe("pending_payment");
    expect(fresh?.payment?.status).toBe("pending");
  });

  it("cancels an expired invoice, restores stock, and returns the promo slot", async () => {
    const order = await createOrder({ withProduct: true, withPromo: true });
    // Order creation reserved one unit and consumed one promo slot; undo only
    // the stock here so the expiry path's restore is observable.
    await db.product.update({ where: { id: productId }, data: { stock: 4 } });
    await db.promoCode.update({ where: { code: "HEMAT" }, data: { usedCount: 4 } });

    await expect(settle(order.code, { status: "expire" })).resolves.toEqual({ ok: true });

    const fresh = await db.order.findUnique({
      where: { id: order.id },
      include: { payment: true, events: true },
    });
    expect(fresh?.status).toBe("cancelled");
    expect(fresh?.payment?.status).toBe("expired");
    expect(fresh?.events.some((event) => event.state === "cancelled")).toBe(true);

    const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stock).toBe(5);
    const promo = await db.promoCode.findUniqueOrThrow({ where: { code: "HEMAT" } });
    expect(promo.usedCount).toBe(3);
  });

  it("refunds a settlement that lands after the invoice was cancelled", async () => {
    const order = await createOrder({ status: "cancelled", paymentStatus: "expired" });

    // The state machine credits the wallet and reports the order as already
    // past its payable window; the money movement is what matters here.
    await expect(settle(order.code)).resolves.toMatchObject({ ok: true });

    const ledger = await db.walletLedger.findMany({ where: { orderCode: order.code } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "refund", amount: TOTAL, balanceAfter: TOTAL });

    const payment = await db.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe("settled");

    // A gateway retry must not credit the buyer twice.
    await expect(settle(order.code)).resolves.toEqual({ ok: true, alreadyProcessed: true });
    expect(await db.walletLedger.count({ where: { orderCode: order.code } })).toBe(1);
  });

  it("does not settle a capture that is still under fraud review", async () => {
    const order = await createOrder();

    const result = await settle(order.code, { status: "capture", fraudStatus: "challenge" });

    expect(result.ok).toBe(false);
    const fresh = await db.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(fresh?.status).toBe("pending_payment");
    expect(fresh?.payment?.status).toBe("pending");
  });
});

describe("POST /api/payments/tripay", () => {
  function signedRequest(raw: string, signature: string) {
    return new NextRequest(new URL("http://localhost/api/payments/tripay"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-callback-event": "payment_status",
        "x-callback-signature": signature,
      },
      body: raw,
    });
  }

  it("rejects a body whose HMAC signature does not match", async () => {
    const order = await createOrder();
    const raw = JSON.stringify({
      reference: "REF-BAD",
      merchant_ref: order.code,
      status: "PAID",
    });

    const response = await tripayPOST(signedRequest(raw, "deadbeef"));

    expect(response.status).toBe(401);
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("pending_payment");
  });

  it("verifies the signature, reads the gateway truth, and settles the order", async () => {
    const order = await createOrder();
    const raw = JSON.stringify({
      reference: "REF-OK",
      merchant_ref: order.code,
      status: "PAID",
    });
    const signature = createHmac("sha256", TRIPAY_PRIVATE_KEY).update(raw).digest("hex");

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      // Keep the argument so the assertion below can read it from mock.calls.
      void input;
      return new Response(
        JSON.stringify({
          success: true,
          data: { reference: "REF-OK", merchant_ref: order.code, status: "PAID", amount: TOTAL },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await tripayPOST(signedRequest(raw, signature));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ handled: true });

    const fresh = await db.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(fresh?.status).toBe("paid");
    expect(fresh?.payment?.status).toBe("settled");

    // The signed body only picks the invoice; money is decided by the detail API.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/transaction/detail?reference=REF-OK");
  });
});
