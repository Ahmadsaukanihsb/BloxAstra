"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getWithdrawalConfig } from "@/lib/wallet";
import { formatIDR } from "@/lib/format";
import { adminUserIds, notifyMany } from "@/lib/notifications";
import type { Prisma } from "@prisma/client";

export type WithdrawalResult =
  | { ok: true; ref: string }
  | { ok: false; code: "INVALID" | "FORBIDDEN" | "STATE"; error: string };

const withdrawalSchema = z.object({
  bank: z.string().trim().min(2).max(40),
  accountNumber: z.string().trim().regex(/^\d{8,20}$/, "Nomor rekening 8–20 digit."),
  amount: z.number().int().min(1).max(1_000_000_000),
});

function randomRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `WD-${out}`;
}

async function appendLedger(
  tx: Prisma.TransactionClient,
  data: {
    userId: string;
    sellerId: string;
    type: string;
    amount: number;
    note: string;
    orderCode?: string;
  },
) {
  const aggregate = await tx.walletLedger.aggregate({
    where: { userId: data.userId },
    _sum: { amount: true },
  });
  const balanceAfter = (aggregate._sum.amount ?? 0) + data.amount;
  return tx.walletLedger.create({
    data: {
      userId: data.userId,
      sellerId: data.sellerId,
      type: data.type,
      amount: data.amount,
      balanceAfter,
      note: data.note,
      orderCode: data.orderCode ?? null,
    },
  });
}

/** Seller requests a wallet withdrawal — deducts balance immediately. */
export async function requestWithdrawal(rawInput: unknown): Promise<WithdrawalResult> {
  const user = await requireRole("seller");

  const parsed = withdrawalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      error: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }
  const input = parsed.data;

  const profile = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }

  const penalty = await db.walletLedger.aggregate({
    where: { userId: user.id, type: "penalty_debt" },
    _sum: { amount: true },
  });
  if ((penalty._sum.amount ?? 0) < 0) {
    return {
      ok: false,
      code: "STATE",
      error: "Ada debit paksa yang belum diselesaikan. Penarikan dinonaktifkan sementara.",
    };
  }

  const { minAmount, fee } = await getWithdrawalConfig();
  if (input.amount < minAmount) {
    return {
      ok: false,
      code: "INVALID",
      error: `Minimum penarikan ${formatIDR(minAmount)}.`,
    };
  }

  const totalDeduct = input.amount + fee;

  let ref = randomRef();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const outcome = await db.$transaction(async (tx) => {
        // Balance is re-read *inside* the transaction so two concurrent
        // withdrawals can never both see the same pre-deduction balance.
        const aggregate = await tx.walletLedger.aggregate({
          where: { userId: user.id },
          _sum: { amount: true },
        });
        const available = aggregate._sum.amount ?? 0;
        if (totalDeduct > available) return { insufficient: true as const };

        const created = await tx.withdrawal.create({
          data: {
            userId: user.id,
            sellerId: profile.id,
            amount: input.amount,
            bank: input.bank,
            accountNumber: input.accountNumber,
            fee,
            status: "pending",
            ref,
          },
        });
        await appendLedger(tx, {
          userId: user.id,
          sellerId: profile.id,
          type: "withdrawal",
          amount: -totalDeduct,
          note: `Penarikan ke ${input.bank} ····${input.accountNumber.slice(-4)}`,
        });
        return { insufficient: false as const, withdrawal: created };
      });

      if (outcome.insufficient) {
        return {
          ok: false,
          code: "STATE",
          error: "Saldo tidak mencukupi untuk penarikan ini (termasuk biaya admin).",
        };
      }
      revalidatePath("/dompet");
      revalidatePath("/dashboard/penjual");
      await notifyMany(await adminUserIds(), {
        kind: "withdrawal_submitted",
        title: `Penarikan baru ${outcome.withdrawal.ref}`,
        body: `${formatIDR(input.amount)} ke ${input.bank} , menunggu persetujuan.`,
        link: "/admin",
      });
      return { ok: true, ref: outcome.withdrawal.ref };
    } catch (error) {
      if (isUniqueCollision(error)) {
        ref = randomRef();
        continue;
      }
      throw error;
    }
  }

  return { ok: false, code: "STATE", error: "Gagal membuat referensi penarikan. Coba lagi." };
}

function isUniqueCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
