import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { applyPaymentNotification } from "@/lib/payments";
import { creditTopUp, notifyTopUpCredited } from "@/lib/topup";
import { verifyMidtransSignature, type MidtransNotificationPayload } from "@/lib/midtrans";

/**
 * Midtrans payment notification webhook. Verifies the SHA-512 signature,
 * then routes the event through the shared payment state machine. Always
 * answers 200 for handled/idempotent events so Midtrans stops retrying.
 *
 * `order_id` may be an order code (BX-XXXXXX → escrow state machine) or a
 * top-up code (TU-XXXXXX → wallet credit). Both paths are idempotent.
 */
export async function POST(request: NextRequest) {
  let payload: MidtransNotificationPayload;
  try {
    payload = (await request.json()) as MidtransNotificationPayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const required = ["order_id", "status_code", "gross_amount", "signature_key", "transaction_status"];
  for (const field of required) {
    if (typeof payload?.[field] !== "string") {
      return NextResponse.json({ message: `Missing field: ${field}` }, { status: 400 });
    }
  }

  let signatureOk = false;
  try {
    signatureOk = verifyMidtransSignature(payload);
  } catch {
    // Config error (e.g. missing server key) — answer 200 so Midtrans does
    // not retry-storm a condition webhooks can never fix.
    return NextResponse.json({ message: "verifier_unavailable", handled: false }, { status: 200 });
  }
  if (!signatureOk) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  const grossAmount = Number(payload.gross_amount);
  if (!Number.isFinite(grossAmount)) {
    return NextResponse.json({ message: "Invalid gross_amount" }, { status: 400 });
  }

  // ── Wallet top-up (TU-XXXXXX) ────────────────────────────────────────────
  if (payload.order_id.startsWith("TU-")) {
    const topUp = await db.topUp.findUnique({
      where: { code: payload.order_id },
      select: { userId: true, amount: true, fee: true },
    });
    if (!topUp) {
      return NextResponse.json({ message: "unknown_topup", handled: false }, { status: 200 });
    }
    // Gateway charges amount + fee; the wallet is credited the net amount.
    if (grossAmount !== topUp.amount + topUp.fee) {
      return NextResponse.json({ message: "amount_mismatch", handled: false }, { status: 200 });
    }
    const settled = payload.transaction_status === "settlement" || payload.transaction_status === "capture";
    if (settled && payload.fraud_status !== "deny") {
      const credited = await creditTopUp({
        userId: topUp.userId,
        code: payload.order_id,
        amount: topUp.amount,
      });
      if (credited) await notifyTopUpCredited(topUp.userId, payload.order_id, topUp.amount);
      return NextResponse.json({ message: "ok", handled: true, credited });
    }
    await db.topUp.updateMany({
      where: { code: payload.order_id, status: "pending" },
      data: { status: "failed" },
    });
    return NextResponse.json({ message: "ok", handled: true, credited: false });
  }

  const result = await applyPaymentNotification({
    orderCode: payload.order_id,
    status: payload.transaction_status,
    fraudStatus: payload.fraud_status,
    grossAmount,
    raw: payload,
  });

  // Business-level rejections (amount mismatch, unknown status, order not found)
  // are permanent conditions; answer 200 so Midtrans stops retrying. Signature
  // and schema errors above still return 4xx.
  if (!result.ok) {
    return NextResponse.json(
      { message: result.reason ?? "Rejected", handled: false },
      { status: 200 },
    );
  }
  return NextResponse.json({ message: "ok", handled: true });
}
