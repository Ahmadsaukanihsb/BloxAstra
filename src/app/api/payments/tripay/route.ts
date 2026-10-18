import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { applyPaymentNotification } from "@/lib/payments";
import { creditTopUp, notifyTopUpCredited } from "@/lib/topup";
import {
  fetchTripayDetail,
  tripayToMidtransStatus,
  verifyTripayCallback,
  TripayNotFoundError,
  type TripayCallbackPayload,
} from "@/lib/tripay";
import { classifyMidtransStatus, retiredTopUpStatus } from "@/lib/midtrans";

/**
 * Tripay payment callback. Verifies the HMAC-SHA256 signature over the RAW
 * body, then routes through the shared payment state machine. The signed
 * callback only decides WHICH invoice to look at — the Status Detail API is
 * the authority on what happened to the money, same as the buyer reconcile.
 * Always answers 200 for handled/idempotent events so Tripay stops retrying.
 *
 * `merchant_ref` may be an order code (BX-XXXXXX → escrow state machine) or
 * a top-up code (TU-XXXXXX → wallet credit). Both paths are idempotent.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => "");
  const signatureOk = verifyTripayCallback(rawBody, request.headers.get("x-callback-signature"));
  if (!signatureOk) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }
  // Only payment updates concern us — ignore anything else Tripay may send.
  if (request.headers.get("x-callback-event") !== "payment_status") {
    return NextResponse.json({ message: "ignored", handled: false }, { status: 200 });
  }

  let payload: TripayCallbackPayload;
  try {
    payload = JSON.parse(rawBody) as TripayCallbackPayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (typeof payload?.reference !== "string" || typeof payload?.merchant_ref !== "string") {
    return NextResponse.json({ message: "Missing field: reference/merchant_ref" }, { status: 400 });
  }

  // Authoritative read: what Tripay says about this reference right now.
  let merchantRef: string;
  let status: string;
  let amount: number;
  try {
    const detail = await fetchTripayDetail(payload.reference);
    merchantRef = detail.merchantRef;
    status = detail.status;
    amount = detail.amount;
  } catch (error) {
    // Unknown reference or transport failure — a retry cannot fix the
    // former, and the buyer reconcile covers the latter. Ack either way.
    if (error instanceof TripayNotFoundError) {
      return NextResponse.json({ message: "unknown_reference", handled: false }, { status: 200 });
    }
    return NextResponse.json({ message: "gateway_unavailable", handled: false }, { status: 200 });
  }
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ message: "Invalid amount" }, { status: 400 });
  }

  const midtransStatus = tripayToMidtransStatus(status);

  // ── Wallet top-up (TU-XXXXXX) ────────────────────────────────────────────
  if (merchantRef.startsWith("TU-")) {
    const topUp = await db.topUp.findUnique({
      where: { code: merchantRef },
      select: { userId: true, amount: true, fee: true },
    });
    if (!topUp) {
      return NextResponse.json({ message: "unknown_topup", handled: false }, { status: 200 });
    }
    // Gateway charges amount + fee; the wallet is credited the net amount.
    if (amount !== topUp.amount + topUp.fee) {
      return NextResponse.json({ message: "amount_mismatch", handled: false }, { status: 200 });
    }
    const verdict = classifyMidtransStatus(midtransStatus);
    if (verdict === "settled") {
      const credited = await creditTopUp({
        userId: topUp.userId,
        code: merchantRef,
        amount: topUp.amount,
        // Signed notification = gateway proof. A row that an earlier
        // notification wrongly flagged `failed` still gets its money.
        settledByGateway: true,
      });
      if (credited) await notifyTopUpCredited(topUp.userId, merchantRef, topUp.amount);
      return NextResponse.json({ message: "ok", handled: true, credited });
    }

    // Only a terminal gateway state may retire an invoice. `pending`
    // (UNPAID) is Tripay's just-issued charge — still payable. Retiring it
    // there would kill an invoice whose settlement lands minutes later.
    if (verdict === "retired") {
      await db.topUp.updateMany({
        where: { code: merchantRef, status: "pending" },
        data: { status: retiredTopUpStatus(midtransStatus) },
      });
    }
    return NextResponse.json({
      message: "ok",
      handled: verdict === "retired",
      credited: false,
    });
  }

  const result = await applyPaymentNotification({
    orderCode: merchantRef,
    status: midtransStatus,
    grossAmount: amount,
    raw: payload,
  });

  // Business-level rejections (amount mismatch, unknown status, order not
  // found) are permanent conditions; answer 200 so Tripay stops retrying.
  // Signature and schema errors above still return 4xx.
  if (!result.ok) {
    return NextResponse.json(
      { message: result.reason ?? "Rejected", handled: false },
      { status: 200 },
    );
  }
  return NextResponse.json({ message: "ok", handled: true });
}
