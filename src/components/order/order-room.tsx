"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatDateTime, formatIDR } from "@/lib/format";
import type { OrderDetail, OrderReview, OrderRoomMessage } from "@/lib/orders";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, OptionCard, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { Countdown } from "@/components/order/runtime";
import { DisputeThread, EvidencePicker } from "@/components/order/dispute-evidence";
import { ReviewCard, ReviewForm } from "@/components/order/review-form";
import {
  cancelOrderAfk,
  confirmOrderReceived,
  fileOrderDispute,
  markOrderShipped,
  revealOrderCredentials,
  sendRoomMessage,
  startOrderProcessing,
} from "@/app/actions/room";
import { reconcilePaymentStatus } from "@/app/actions/orders";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconChat,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconInfo,
  IconLock,
  IconPackage,
  IconRefresh,
  IconScale,
  IconScanFace,
  IconShieldCheck,
  IconStorefront,
  IconTimer,
} from "@/components/ui/icons";

const DISPUTE_REASONS = [
  { id: "not_received", title: "Barang tidak diterima", description: "Penjual menandai terkirim tetapi barang tidak masuk ke akunmu." },
  { id: "item_invalid", title: "Item tidak sesuai", description: "Jenis, jumlah, atau kualitas item berbeda dari deskripsi listing." },
  { id: "account_banned_carding", title: "Akun kena banned / carding", description: "Ada surat resmi Roblox dengan frasa Unauthorized Charges atau Disputed Charge." },
  { id: "seller_unresponsive", title: "Penjual tidak merespons", description: "Penjual berhenti membalas padahal pesanan belum terkirim." },
];

export function OrderRoom({
  order,
  messages,
  review,
}: {
  order: OrderDetail;
  messages: OrderRoomMessage[];
  review: OrderReview | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("not_received");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [revealed2fa, setRevealed2fa] = useState<string | null>(null);
  const [steps, setSteps] = useState(order.handoverSteps);
  const [copied, setCopied] = useState(false);
  const [slaExpired, setSlaExpired] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reconcileNote, setReconcileNote] = useState<
    { tone: "astra" | "info" | "danger"; text: string } | null
  >(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const isBuyer = order.viewerRole === "buyer";
  const isSellerViewer = order.viewerRole === "seller";
  const isCredentialOrder = Boolean(order.credentials);
  const watermark = `BUKTI RESMI BLOX ASTRA | ORDER #${order.code}`;
  const locked = ["disputed", "refunded", "completed", "cancelled"].includes(order.state);
  // Live states keep polling for counterpart messages + status moves.
  const live = ["pending_payment", "paid", "processing", "shipped", "disputed"].includes(
    order.state,
  );

  // Poll the room while it is live; only yank scroll when the reader is
  // already near the bottom (same guard as the seller group chat).
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [live, router]);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    if (nearBottom) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  function refresh() {
    router.refresh();
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      const result = await sendRoomMessage({ orderCode: order.code, body: text });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      refresh();
    });
  }

  function confirmReceived() {
    startTransition(async () => {
      const result = await confirmOrderReceived(order.code);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      refresh();
    });
  }

  function requestCancel() {
    startTransition(async () => {
      const result = await cancelOrderAfk(order.code);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      refresh();
    });
  }

  function fileDispute() {
    startTransition(async () => {
      const result = await fileOrderDispute({
        orderCode: order.code,
        reasonId: reason,
        buyerNote: notes,
        evidence,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      setDisputeOpen(false);
      setEvidence([]);
      refresh();
    });
  }

  function claimAndProcess() {
    startTransition(async () => {
      const result = await startOrderProcessing(order.code);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      refresh();
    });
  }

  function shipOrder() {
    startTransition(async () => {
      const result = await markOrderShipped(order.code);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      refresh();
    });
  }
  function revealCredentials() {
    startTransition(async () => {
      const result = await revealOrderCredentials(order.code);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      setRevealedPassword(result.password);
      setRevealedPin(result.parentalPin);
      setRevealed2fa(result.twoFactorBackupCodes);
    });
  }

  function checkPaymentStatus() {
    setReconcileNote(null);
    startTransition(async () => {
      const result = await reconcilePaymentStatus(order.code);
      if (!result.ok) {
        setReconcileNote({ tone: "danger", text: result.error });
        return;
      }
      if (result.paid) {
        setReconcileNote({
          tone: "astra",
          text: "Pembayaran lunas. Dana ditahan platform; halaman dimuat ulang.",
        });
      } else {
        setReconcileNote({
          tone: "info",
          text: "Midtrans belum menerima pembayaran. Selesaikan dulu lewat tombol di bawah.",
        });
      }
      refresh();
    });
  }

  function toggleStep(id: string) {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, done: !step.done } : step)),
    );
  }

  const completedSteps = steps.filter((step) => step.done).length;

  return (
    <div className="flex flex-col gap-4">
      {order.slaRemainingSeconds !== null && order.slaLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-robux/[0.06] px-5 py-3.5 outline outline-1 -outline-offset-1 outline-robux/20">
          <span className="flex items-center gap-2.5 text-[12px] text-ink-dim">
            <IconTimer size={16} className="text-robux" />
            {order.slaLabel}
          </span>
          <Countdown
            seconds={order.slaRemainingSeconds}
            className="text-[14px]"
            onExpire={() => setSlaExpired(true)}
          />
        </div>
      ) : null}

      {slaExpired ? (
        <Notice tone="warn" title="Masa tunggu berakhir">
          Kalau kamu belum mengajukan sengketa, dana dilepas otomatis ke penjual dalam satu siklus
          worker.
        </Notice>
      ) : null}

      {actionError ? (
        <Notice tone="danger" title="Aksi gagal">
          {actionError}
        </Notice>
      ) : null}

      {/* Chat room */}
      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
              <IconChat size={16} className="text-astra-ink" />
              Ruang pesanan
            </span>
            <span className="flex items-center gap-2 text-[11px] text-ink-mute">
              <IconLock size={13} />
              terenkripsi · hanya pembeli, penjual, dan admin
            </span>
          </div>

          <div ref={chatRef} className="flex max-h-[420px] flex-col gap-3.5 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <p className="text-[12px] text-ink-mute">
                Belum ada pesan. Koordinasi serah terima lewat ruang ini ya.
              </p>
            ) : null}
            {messages.map((message) => {
              const mine = message.from === order.viewerRole;
              const system = message.from === "system";
              return (
                <div
                  key={message.id}
                  className={cx("flex flex-col gap-1", mine ? "items-end" : "items-start")}
                >
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    {message.from} · {formatDateTime(message.at)}
                  </span>
                  <div
                    className={cx(
                      "max-w-[88%] rounded-well px-4 py-2.5 text-[12px] leading-relaxed",
                      system
                        ? "bg-astra/[0.07] text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20"
                        : mine
                          ? "bg-canvas text-ink"
                          : "bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line",
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-line p-4 sm:flex-row sm:items-end">
            <Field label="Pesan" htmlFor="chat-input" className="flex-1">
              <TextArea
                id="chat-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Tulis instruksi atau tautan private server…"
                className="min-h-12 py-2.5"
              />
            </Field>
            <Button
              onClick={send}
              disabled={!draft.trim() || isPending}
              trailingIcon={<IconArrowRight size={15} />}
            >
              Kirim
            </Button>
          </div>
        </div>
      </div>

      {/* Seller actions */}
      {isSellerViewer && (order.state === "paid" || order.state === "processing") ? (
        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2.5 text-base font-bold text-ink">
                <IconStorefront size={18} className="text-astra-ink" />
                Panel penjual
              </h2>
              <p className="text-[12px] text-ink-mute">
                Perbarui status pesanan agar pembeli tahu progres dan SLA terjaga.
              </p>
            </div>
            {order.state === "paid" ? (
              <Button
                size="lg"
                onClick={claimAndProcess}
                disabled={isPending}
                leadingIcon={<IconPackage size={16} />}
              >
                Mulai proses pesanan
              </Button>
            ) : null}
            {order.state === "processing" ? (
              <Button
                size="lg"
                onClick={shipOrder}
                disabled={isPending}
                leadingIcon={<IconCheck size={16} />}
              >
                Tandai barang terkirim
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Order details (gamepass URL + buyer note) */}
      {order.gamepassUrl || order.buyerNote ? (
        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-4 p-6">
            <h2 className="flex items-center gap-2.5 text-base font-bold text-ink">
              <IconInfo size={18} className="text-astra-ink" />
              Detail pesanan
            </h2>
              {order.gamepassUrl && /^https:\/\//i.test(order.gamepassUrl) ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-ink-mute">Tautan gamepass</span>
                  <a
                    href={order.gamepassUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate text-[12px] font-bold text-astra-ink underline underline-offset-4"
                  >
                    {order.gamepassUrl}
                  </a>
                </div>
              ) : null}
            {order.buyerNote ? (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-mute">Catatan pembeli</span>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink">{order.buyerNote}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Handover wizard for credential orders (buyer only — sellers and
          admins have no business seeing even masked buyer credentials).
          Hidden once the handover is void (refunded/cancelled). */}
      {isBuyer &&
      ["paid", "processing", "shipped", "completed", "disputed"].includes(order.state) &&
      isCredentialOrder &&
      order.credentials ? (
        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2.5 text-base font-bold text-ink">
                  <IconScanFace size={18} className="text-astra-ink" />
                  Wizard serah terima akun
                </h2>
                <p className="text-[12px] text-ink-mute">
                  Tandai setiap langkah setelah kamu verifikasi sendiri di pengaturan Roblox.
                </p>
              </div>
              <Badge tone="astra">
                {completedSteps}/{steps.length} langkah selesai
              </Badge>
            </div>

            <div className="flex flex-col gap-2.5">
              {steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  aria-pressed={step.done}
                  className={cx(
                    "flex items-start gap-3.5 rounded-well p-4 text-left transition-colors duration-300 ease-[var(--ease-astra)]",
                    step.done
                      ? "bg-astra/[0.06] outline outline-1 -outline-offset-1 outline-astra/25"
                      : "bg-canvas outline outline-1 -outline-offset-1 outline-line hover:bg-canvas",
                  )}
                >
                  <span
                    className={cx(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                      step.done ? "bg-astra text-white" : "bg-canvas text-transparent",
                    )}
                  >
                    <IconCheck size={11} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className={cx("text-[13px] font-bold", step.done ? "text-ink" : "text-ink-dim")}>
                      {step.label}
                    </span>
                    <span className="text-[11px] leading-relaxed text-ink-mute">{step.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-ink-mute">Username</span>
                <span className="num text-[12px] text-ink">{order.credentials.username}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-ink-mute">Kata sandi sementara</span>
                <span className="flex items-center gap-2">
                  <span className="num text-[12px] text-ink">
                    {revealedPassword ?? order.credentials.passwordMasked}
                  </span>
                  {!revealedPassword ? (
                    <button
                      type="button"
                      aria-label="Tampilkan sandi"
                      onClick={revealCredentials}
                      disabled={isPending}
                      className="grid size-7 place-items-center rounded-full bg-canvas text-ink-dim transition-colors hover:text-ink"
                    >
                      <IconEye size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Sembunyikan sandi"
                      onClick={() => setRevealedPassword(null)}
                      className="grid size-7 place-items-center rounded-full bg-canvas text-ink-dim transition-colors hover:text-ink"
                    >
                      <IconEyeOff size={14} />
                    </button>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-ink-mute">Parental PIN</span>
                <span className="flex items-center gap-2">
                  <span className="num text-[12px] text-ink">
                    {revealedPin ?? order.credentials.parentalPinMasked}
                  </span>
                  {!revealedPin ? (
                    <button
                      type="button"
                      aria-label="Tampilkan PIN"
                      onClick={revealCredentials}
                      disabled={isPending}
                      className="grid size-7 place-items-center rounded-full bg-canvas text-ink-dim transition-colors hover:text-ink"
                    >
                      <IconEye size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Sembunyikan PIN"
                      onClick={() => setRevealedPin(null)}
                      className="grid size-7 place-items-center rounded-full bg-canvas text-ink-dim transition-colors hover:text-ink"
                    >
                      <IconEyeOff size={14} />
                    </button>
                  )}
                </span>
              </div>
              {order.credentials.twoFactorMasked || revealed2fa ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] text-ink-mute">Kode cadangan 2FA</span>
                  <span className="flex items-center gap-2">
                    <span className="num max-w-[12rem] truncate text-[12px] text-ink">
                      {revealed2fa ?? order.credentials.twoFactorMasked}
                    </span>
                    {!revealed2fa ? (
                      <button
                        type="button"
                        aria-label="Tampilkan kode 2FA"
                        onClick={revealCredentials}
                        disabled={isPending}
                        className="grid size-7 place-items-center rounded-full bg-canvas text-ink-dim transition-colors hover:text-ink"
                      >
                        <IconEye size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Sembunyikan kode 2FA"
                        onClick={() => setRevealed2fa(null)}
                        className="grid size-7 place-items-center rounded-full bg-canvas text-ink-dim transition-colors hover:text-ink"
                      >
                        <IconEyeOff size={14} />
                      </button>
                    )}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<IconCopy size={14} />}
                  onClick={() => {
                    const text = `Username: ${order.credentials?.username ?? ""}\nPassword: ${revealedPassword ?? order.credentials?.passwordMasked ?? ""}\nPIN: ${revealedPin ?? order.credentials?.parentalPinMasked ?? ""}\n2FA: ${revealed2fa ?? order.credentials?.twoFactorMasked ?? ""}`;
                    navigator.clipboard.writeText(text).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    });
                  }}
                >
                  {copied ? "Tersalin" : "Salin kredensial"}
                </Button>
                <span className="text-[11px] text-ink-mute">
                  Dihapus permanen 7×24 jam setelah pesanan selesai
                </span>
              </div>
            </div>

            <Notice tone="warn" icon={<IconInfo size={15} />} title="Wajib setelah selesai">
              Ganti kata sandi dan matikan akses sementara. Kredensial yang dibagikan penjual tidak
              boleh dipakai lagi setelah kamu menandai langkah terakhir.
            </Notice>
          </div>
        </div>
      ) : null}

      {/* Dispute thread — visible to buyer, seller, and admin alike. The
          reply form inside gates itself to the seller; everyone else reads. */}
      {order.state === "disputed" && order.dispute ? (
        <DisputeThread
          orderCode={order.code}
          dispute={order.dispute}
          viewerRole={order.viewerRole}
        />
      ) : null}

      {/* Buyer actions */}
      {isBuyer ? (
        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-ink">Tindakan pembeli</h2>
              <p className="text-[12px] text-ink-mute">
                Dana hanya bergerak atas tindakanmu, atau otomatis setelah masa tunggu berakhir.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {order.state === "pending_payment" ? (
                <div className="flex flex-col gap-3 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-ink">Menunggu pembayaran</span>
                    {order.slaRemainingSeconds !== null && !slaExpired ? (
                      <Countdown
                        seconds={order.slaRemainingSeconds}
                        onExpire={() => setSlaExpired(true)}
                      />
                    ) : null}
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-mute">
                    {slaExpired
                      ? "Tagihan kedaluwarsa. Pesanan akan dibatalkan otomatis. Bila kamu sudah membayar, tekan cek status di bawah."
                      : "Selesaikan pembayaran sebelum tagihan kedaluwarsa. Sudah bayar tapi status macet? Tekan cek status, sistem tanya langsung ke Midtrans."}
                  </p>
                  {reconcileNote ? (
                    <Notice tone={reconcileNote.tone}>{reconcileNote.text}</Notice>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {order.paymentCheckoutUrl && !slaExpired ? (
                      <ButtonLink
                        href={order.paymentCheckoutUrl}
                        trailingIcon={<IconArrowRight size={15} />}
                        iconCircleClassName="bg-paper/20"
                      >
                        Lanjutkan pembayaran
                      </ButtonLink>
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={isPending}
                      onClick={checkPaymentStatus}
                      leadingIcon={<IconRefresh size={15} />}
                    >
                      {isPending ? "Mengecek…" : "Saya sudah bayar, cek status"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {order.canConfirm && !locked ? (
                <Button
                  size="lg"
                  variant="primary"
                  onClick={confirmReceived}
                  disabled={isPending}
                  trailingIcon={<IconShieldCheck size={16} />}
                  iconCircleClassName="bg-paper/20"
                >
                  Barang diterima, lepas dana ke penjual
                </Button>
              ) : null}

              {order.state === "completed" ? (
                <Notice tone="astra" title="Barang diterima · dana dilepas">
                  Terima kasih! Dana sudah dicairkan ke dompet penjual.
                </Notice>
              ) : null}

              {order.state === "completed" && isBuyer && !review ? (
                <ReviewForm orderCode={order.code} sellerName={order.sellerStoreName} />
              ) : null}
              {order.state === "completed" && review ? <ReviewCard review={review} /> : null}

              {order.canCancelAfk && !locked ? (
                <Button
                  variant="danger"
                  onClick={requestCancel}
                  disabled={isPending}
                  leadingIcon={<IconAlert size={15} />}
                >
                  Batalkan pesanan & refund penuh (penjual tidak merespons)
                </Button>
              ) : null}

              {order.state === "refunded" ? (
                <Notice tone="danger" title="Pesanan dibatalkan, refund dikirim">
                  Dana dikembalikan ke dompetmu. Skor performa penjual diturunkan otomatis.
                </Notice>
              ) : null}

              {!locked && ["paid", "processing", "shipped"].includes(order.state) ? (
                <button
                  type="button"
                  onClick={() => setDisputeOpen((open) => !open)}
                  className="flex items-center justify-between rounded-well bg-canvas px-4 py-3 text-left text-[12px] text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:bg-canvas"
                >
                  <span className="flex items-center gap-2.5">
                    <IconScale size={16} className="text-danger" />
                    Ajukan sengketa resmi
                  </span>
                  <IconArrowRight
                    size={15}
                    className={cx(
                      "transition-transform duration-300",
                      disputeOpen && "rotate-90",
                    )}
                  />
                </button>
              ) : null}
            </div>

            <AnimatePresence initial={false}>
              {disputeOpen && !locked ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-4 rounded-well bg-danger/[0.04] p-5 outline outline-1 -outline-offset-1 outline-danger/20">
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-bold text-ink">Alasan sengketa</span>
                      <span className="text-[11px] text-ink-mute">
                        Sengketa membekukan dana. Admin memutuskan setelah kedua pihak mengirim bukti.
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Alasan sengketa">
                      {DISPUTE_REASONS.map((item) => (
                        <OptionCard
                          key={item.id}
                          selected={reason === item.id}
                          onSelect={() => setReason(item.id)}
                          title={item.title}
                          description={item.description}
                        />
                      ))}
                    </div>

                    <Field
                      label="Kronologi kejadian"
                      htmlFor="dispute-notes"
                      hint="Sertakan jam kejadian, nama server, dan username pelaku bila ada."
                    >
                      <TextArea
                        id="dispute-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Barang tidak masuk padahal pesanan sudah ditandai terkirim…"
                      />
                    </Field>

                    <EvidencePicker items={evidence} onChange={setEvidence} />

                    <Notice tone="danger" icon={<IconAlert size={15} />} title="Untuk kasus carding">
                      Wajib melampirkan surat resmi penutupan akun dari Roblox yang memuat username,
                      tanggal insiden, dan frasa Unauthorized Charges atau Disputed Charge.
                    </Notice>

                    <Button
                      variant="danger"
                      disabled={notes.trim().length < 12 || isPending}
                      onClick={fileDispute}
                      leadingIcon={<IconScale size={15} />}
                    >
                      Kirim sengketa ke admin
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-[11px] text-ink-mute">
                Butuh bantuan? Tim mediasi menjawab lewat ruang ini, bukan lewat WhatsApp.
              </span>
              <Link
                href="/pesanan"
                className="text-[11px] text-ink-dim underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                Kembali ke daftar pesanan
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5 rounded-card bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
          <span className="flex items-center gap-2 text-[12px] font-bold text-ink">
            <IconShieldCheck size={15} className="text-astra-ink" />
            Ditahan platform
          </span>
          <span className="num text-[18px] font-extrabold text-astra-ink">
            {formatIDR(order.total)}
          </span>
          <span className="text-[11px] leading-relaxed text-ink-mute">
            Auto-release berjalan otomatis bila kamu tidak mengajukan sengketa dalam masa tunggu.
          </span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-card bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
          <span className="flex items-center gap-2 text-[12px] font-bold text-ink">
            <IconLock size={15} className="text-info" />
            Bukti ter-watermark
          </span>
          <span className="num text-[12px] text-ink-dim">{watermark}</span>
          <span className="text-[11px] leading-relaxed text-ink-mute">
            Berkas mentah tanpa watermark langsung dimusnahkan agar tangkapan layar tidak bisa didaur
            ulang.
          </span>
        </div>
      </div>
    </div>
  );
}
