"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatChatDay, formatDateTime, formatIDR } from "@/lib/format";
import { compressImageFile } from "@/lib/image-compress";
import { useLiveStream } from "@/lib/live";
import type { OrderChatPresence, OrderDetail, OrderReview, OrderRoomMessage } from "@/lib/orders";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, OptionCard, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { SellerAvatar } from "@/components/ui/art";
import { Countdown } from "@/components/order/runtime";
import { DisputeThread, EvidencePicker } from "@/components/order/dispute-evidence";
import { ReviewCard, ReviewForm } from "@/components/order/review-form";
import {
  cancelOrderAfk,
  confirmOrderReceived,
  fileOrderDispute,
  markOrderSeen,
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
  IconUpload,
  IconX,
} from "@/components/ui/icons";

const DISPUTE_REASONS = [
  { id: "not_received", title: "Barang tidak diterima", description: "Penjual menandai terkirim tetapi barang tidak masuk ke akunmu." },
  { id: "item_invalid", title: "Item tidak sesuai", description: "Jenis, jumlah, atau kualitas item berbeda dari deskripsi listing." },
  { id: "account_banned_carding", title: "Akun kena banned / carding", description: "Ada surat resmi Roblox dengan frasa Unauthorized Charges atau Disputed Charge." },
  { id: "seller_unresponsive", title: "Penjual tidak merespons", description: "Penjual berhenti membalas padahal pesanan belum terkirim." },
];

const CHAT_IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const CHAT_IMAGE_MAX_BYTES = 1_500_000;

/** "baru saja" / "12 menit lalu" / falls back to the absolute date. */
function lastSeenLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return formatDateTime(iso);
}

/** Jakarta day bucket — messages are grouped and separated by this key. */
function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-mute">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function OrderRoom({
  order,
  messages,
  review,
  presence,
}: {
  order: OrderDetail;
  messages: OrderRoomMessage[];
  review: OrderReview | null;
  presence: OrderChatPresence;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [readingImage, setReadingImage] = useState(false);
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
  const attachRef = useRef<HTMLInputElement>(null);
  // Day labels ("Hari ini") cannot be read from the clock during render — that
  // is an impure read. It refreshes once a minute so a room left open across
  // midnight flips its own dividers.
  const [now, setNow] = useState<number | null>(null);
  // Only messages that land while the room is open rise in; the backlog the
  // visit was loaded with is already there. Initial state is read once — a
  // refresh keeps the same component instance, so the count stays put.
  const [mountCount] = useState(() => messages.length);

  const isBuyer = order.viewerRole === "buyer";
  const isSellerViewer = order.viewerRole === "seller";
  const isCredentialOrder = Boolean(order.credentials);
  const watermark = `BUKTI RESMI BLOX ASTRA | ORDER #${order.code}`;
  const locked = ["disputed", "refunded", "completed", "cancelled"].includes(order.state);
  // A settled order has nothing left to coordinate; the composer is swapped
  // for a closed bar and the server rejects sends either way.
  const chatClosed = ["completed", "cancelled", "refunded"].includes(order.state);
  // Live states keep polling for counterpart messages + status moves.
  const live = ["pending_payment", "paid", "processing", "shipped", "disputed"].includes(
    order.state,
  );
  const counterpartName = isBuyer ? order.sellerStoreName : order.buyerName;
  const counterpartImage = isBuyer ? order.sellerStoreImage : order.buyerImage;
  const counterpartOnline = isBuyer ? presence.sellerOnline : presence.buyerOnline;
  const counterpartLastSeenAt = isBuyer ? presence.sellerLastSeenAt : presence.buyerLastSeenAt;

  // Push channel: the counterpart's messages and every status move land here
  // in well under a second. Reads still go through the normal server path.
  useLiveStream(["room"], () => router.refresh(), live);

  // Fallback poll while the room is live, in case the stream is blocked;
  // only yank scroll when the reader is already near the bottom.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [live, router]);

  useEffect(() => {
    const sync = () => setNow(Date.now());
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    if (nearBottom) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  // The review prompt sits at the end of the chat; land the conversation at
  // the bottom so a buyer who just confirmed sees it without hunting.
  useEffect(() => {
    if (!(isBuyer && order.state === "completed" && !review)) return;
    const node = chatRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [isBuyer, order.state, review]);

  // Opening the room (or a new message landing while it is open) advances the
  // read cursor, which is exactly what clears the list badges and nav count.
  useEffect(() => {
    if (document.visibilityState !== "visible") return;
    void markOrderSeen(order.code);
  }, [order.code, messages.length]);

  function refresh() {
    router.refresh();
  }

  function send() {
    if (isPending) return;
    const text = draft.trim();
    if (!text && !attachedImage) return;
    const image = attachedImage;
    setDraft("");
    setAttachedImage(null);
    startTransition(async () => {
      const result = await sendRoomMessage({
        orderCode: order.code,
        body: text,
        ...(image ? { image } : {}),
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      refresh();
    });
  }

  async function attachImage(file: File | undefined) {
    if (!file) return;
    setAttachError(null);
    if (!file.type.startsWith("image/")) {
      setAttachError("Lampiran harus berupa gambar.");
      return;
    }
    setReadingImage(true);
    try {
      let url: string | null;
      if (file.size > CHAT_IMAGE_MAX_BYTES) {
        // Screenshots are usually well over the cap — squeeze instead of refuse.
        url = await compressImageFile(file, CHAT_IMAGE_MAX_BYTES);
        if (!url) {
          setAttachError(`"${file.name}" di atas 1,5MB dan gagal dikompres.`);
          return;
        }
      } else {
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read"));
          reader.readAsDataURL(file);
        });
      }
      setAttachedImage(url);
    } catch {
      setAttachError("Gagal membaca file. Coba lagi.");
    } finally {
      setReadingImage(false);
      if (attachRef.current) attachRef.current.value = "";
    }
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
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-5 py-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20">
                <IconChat size={15} />
              </span>
              <span className="text-[13px] font-bold text-ink">Ruang pesanan</span>
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-tag px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-mute"
                title="Terenkripsi · hanya pembeli, penjual, dan admin"
              >
                <IconLock size={11} />
                Terenkripsi
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2.5">
              <SellerAvatar
                name={counterpartName}
                size={30}
                imageUrl={counterpartImage}
                className="shrink-0"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[12px] font-bold text-ink">{counterpartName}</span>
                <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-ink-mute">
                  <span
                    aria-hidden
                    className={cx(
                      "size-1.5 shrink-0 rounded-full",
                      counterpartOnline ? "bg-success" : "bg-ink-mute/40",
                    )}
                  />
                  <span className="truncate">
                    {counterpartOnline
                      ? "Online sekarang"
                      : counterpartLastSeenAt
                        ? `Terakhir buka ${lastSeenLabel(counterpartLastSeenAt)}`
                        : "Offline"}
                  </span>
                </span>
              </span>
            </span>
          </div>

          <div ref={chatRef} className="flex h-[min(60vh,520px)] flex-col overflow-y-auto bg-canvas p-4">
            {messages.length === 0 ? (
              <div className="m-auto flex max-w-[36ch] flex-col items-center gap-3 text-center">
                <span className="grid size-12 place-items-center rounded-well text-ink-mute">
                  <IconChat size={22} />
                </span>
                <p className="text-[13px] font-bold text-ink">Belum ada pesan</p>
                <p className="text-[12px] leading-relaxed text-ink-mute">
                  Koordinasi serah terima, kirim bukti, atau tanya progres di sini.
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const mine = message.from === order.viewerRole;
                const system = message.from === "system";
                const previous = messages[index - 1];
                const next = messages[index + 1];
                const newDay = !previous || dayKey(previous.at) !== dayKey(message.at);
                // Consecutive messages from one side read as one block: the
                // avatar and name print once, at the top of it.
                const startsBlock = newDay || !previous || previous.from !== message.from;
                const endsBlock =
                  !next ||
                  next.from === "system" ||
                  next.from !== message.from ||
                  dayKey(next.at) !== dayKey(message.at);
                const senderDisplay =
                  message.from === "buyer"
                    ? order.buyerName
                    : message.from === "seller"
                      ? order.sellerStoreName
                      : "Tim Blox Astra";
                const senderImage =
                  message.from === "seller"
                    ? order.sellerStoreImage
                    : message.from === "buyer"
                      ? order.buyerImage
                      : null;
                const rising = index >= mountCount;

                // System notices are the room talking, not a person: a red chip
                // in the middle, so they can never be mistaken for user text.
                if (system) {
                  const isWarning = message.text.startsWith("Peringatan sistem");
                  return (
                    <Fragment key={message.id}>
                      {newDay && now !== null ? (
                        <DayDivider label={formatChatDay(message.at, now)} />
                      ) : null}
                      <div className={cx("my-1 flex justify-center", rising && "animate-rise")}>
                        <div className="flex max-w-[92%] items-start gap-2 rounded-well bg-danger/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-danger outline outline-1 -outline-offset-1 outline-danger/25">
                          {isWarning ? (
                            <IconAlert size={14} className="mt-0.5 shrink-0 text-danger" />
                          ) : (
                            <IconInfo size={14} className="mt-0.5 shrink-0 text-danger" />
                          )}
                          <span className="break-words whitespace-pre-wrap">{message.text}</span>
                        </div>
                      </div>
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={message.id}>
                    {newDay && now !== null ? (
                      <DayDivider label={formatChatDay(message.at, now)} />
                    ) : null}
                    <div
                      className={cx(
                        "flex w-full items-end gap-2.5",
                        mine ? "justify-end" : "justify-start",
                        startsBlock && !newDay ? "mt-3" : "mt-0.5",
                        rising && "animate-rise",
                      )}
                    >
                      {mine ? null : (
                        <span className="w-[34px] shrink-0">
                          {startsBlock ? (
                            <SellerAvatar name={senderDisplay} size={34} imageUrl={senderImage} />
                          ) : null}
                        </span>
                      )}
                      <div className="flex min-w-0 max-w-[min(78%,30rem)] flex-col gap-1">
                        {startsBlock ? (
                          <span
                            className={cx(
                              "px-1 text-[10px] font-extrabold",
                              mine ? "text-right text-ink-mute" : "text-astra-ink",
                            )}
                          >
                            {mine ? "kamu" : senderDisplay}
                          </span>
                        ) : null}
                        <div
                          className={cx(
                            "w-fit max-w-full rounded-well px-3.5 py-2.5 text-[12px] leading-relaxed break-words whitespace-pre-wrap outline outline-1 -outline-offset-1",
                            mine
                              ? "rounded-br-[6px] bg-astra/15 text-ink outline-astra/30"
                              : "rounded-bl-[6px] bg-paper text-ink outline-line",
                          )}
                        >
                          {message.image && message.image.startsWith("data:image/") ? (
                            <a
                              href={message.image}
                              target="_blank"
                              rel="noreferrer"
                              title="Klik untuk ukuran penuh"
                              className={cx(
                                "block overflow-hidden rounded-control",
                                message.text && "mb-2",
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={message.image}
                                alt={`Lampiran dari ${senderDisplay}`}
                                className="max-h-72 w-full max-w-[16rem] rounded-control object-cover outline outline-1 -outline-offset-1 outline-line"
                              />
                            </a>
                          ) : null}
                          {message.text}
                        </div>
                        {endsBlock ? (
                          <span
                            className={cx(
                              "num flex items-center gap-1.5 px-1 text-[10px] text-ink-mute",
                              mine ? "justify-end" : "justify-start",
                            )}
                          >
                            {formatDateTime(message.at)}
                          </span>
                        ) : null}
                      </div>
                      {mine ? (
                        <span className="w-[34px] shrink-0">
                          {startsBlock ? (
                            <SellerAvatar name={senderDisplay} size={34} imageUrl={senderImage} />
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </Fragment>
                );
              })
            )}

            {/* The review prompt lives at the end of the chat, right after the
                closing system message — the action cards further down the page
                are too easy for buyers to miss. */}
            {isBuyer && order.state === "completed" ? (
              <div className="mx-auto mt-4 w-full max-w-[26rem]">
                {review ? (
                  <ReviewCard review={review} />
                ) : (
                  <ReviewForm orderCode={order.code} sellerName={order.sellerStoreName} />
                )}
              </div>
            ) : null}
          </div>

          {chatClosed ? (
            <div className="border-t border-line p-4">
              <span className="flex items-center gap-2.5 rounded-well bg-canvas px-4 py-3 text-[11px] leading-relaxed text-ink-mute outline outline-1 -outline-offset-1 outline-line">
                <IconLock size={14} className="shrink-0" />
                {order.state === "completed"
                  ? "Pesanan sudah selesai — ruang obrolan ditutup."
                  : "Pesanan dibatalkan — ruang obrolan ditutup."}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 border-t border-line p-4">
            {attachedImage ? (
              <div className="flex items-center gap-3 rounded-well bg-canvas p-2 outline outline-1 -outline-offset-1 outline-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImage}
                  alt="Pratinjau lampiran"
                  className="size-12 shrink-0 rounded-control object-cover outline outline-1 -outline-offset-1 outline-line"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[11px] font-bold text-ink">Lampiran siap dikirim</span>
                  <span className="text-[10px] text-ink-mute">Ikut terkirim bersama pesan ini</span>
                </span>
                <button
                  type="button"
                  aria-label="Hapus lampiran"
                  onClick={() => setAttachedImage(null)}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper hover:text-ink"
                >
                  <IconX size={15} />
                </button>
              </div>
            ) : null}
            {attachError ? <p className="text-xs font-bold text-danger">{attachError}</p> : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              className="flex items-end gap-2.5"
            >
              <input
                ref={attachRef}
                type="file"
                accept={CHAT_IMAGE_ACCEPT}
                className="hidden"
                aria-label="Lampirkan gambar"
                onChange={(event) => void attachImage(event.target.files?.[0] ?? undefined)}
              />
              <button
                type="button"
                aria-label="Lampirkan gambar"
                title={readingImage ? "Membaca gambar…" : "Lampirkan gambar"}
                onClick={() => attachRef.current?.click()}
                disabled={readingImage || Boolean(attachedImage)}
                className="grid size-11 shrink-0 place-items-center rounded-control bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-200 hover:text-ink disabled:pointer-events-none disabled:opacity-45"
              >
                <IconUpload size={16} />
              </button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Tulis pesan…"
                rows={1}
                maxLength={2000}
                className="min-h-[44px] w-full resize-none rounded-well bg-canvas px-4 py-3 text-[13px] text-ink outline outline-1 -outline-offset-1 outline-line placeholder:text-ink-mute focus:outline-astra/40"
              />
              <Button
                type="submit"
                disabled={(!draft.trim() && !attachedImage) || isPending}
                className="shrink-0"
              >
                {isPending ? "Mengirim…" : "Kirim"}
              </Button>
            </form>
            <div className="flex items-center justify-end gap-3 sm:justify-between">
              <span className="hidden text-[10px] text-ink-mute sm:block">
                Enter kirim · Shift+Enter baris baru
              </span>
              <p className="num text-right text-[10px] text-ink-mute">{draft.length}/2000</p>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Seller actions */}
      {isSellerViewer && (order.state === "paid" || order.state === "processing") ? (
        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20">
                <IconStorefront size={16} />
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[15px] font-bold text-ink">Panel penjual</h2>
                <p className="text-[12px] text-ink-mute">
                  Perbarui status pesanan agar pembeli tahu progres dan SLA terjaga.
                </p>
              </div>
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
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20">
                <IconInfo size={16} />
              </span>
              <h2 className="text-[15px] font-bold text-ink">Detail pesanan</h2>
            </div>
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
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20">
                  <IconScanFace size={16} />
                </span>
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-[15px] font-bold text-ink">Wizard serah terima akun</h2>
                  <p className="text-[12px] text-ink-mute">
                    Tandai setiap langkah setelah kamu verifikasi sendiri di pengaturan Roblox.
                  </p>
                </div>
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
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20">
                <IconShieldCheck size={16} />
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[15px] font-bold text-ink">Tindakan pembeli</h2>
                <p className="text-[12px] text-ink-mute">
                  Dana hanya bergerak atas tindakanmu, atau otomatis setelah masa tunggu berakhir.
                </p>
              </div>
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

              {/* Locked until delivery: confirming early would release escrow
                  before the seller ever shipped. */}
              {order.awaitingShipment && !locked ? (
                <div className="flex flex-col gap-1.5">
                  <Button size="lg" variant="primary" disabled>
                    Barang diterima, lepas dana ke penjual
                  </Button>
                  <p className="text-[11px] leading-relaxed text-ink-mute">
                    Tombol aktif setelah penjual menandai barang terkirim. Dana aman di escrow.
                  </p>
                </div>
              ) : null}

              {order.state === "completed" ? (
                <Notice tone="astra" title="Barang diterima · dana dilepas">
                  Terima kasih! Dana sudah dicairkan ke dompet penjual.
                </Notice>
              ) : null}

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

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 rounded-card bg-canvas px-5 py-4 outline outline-1 -outline-offset-1 outline-line">
        <span className="flex items-center gap-2.5 text-[11px] text-ink-mute">
          <IconShieldCheck size={14} className="shrink-0 text-astra-ink" />
          Ditahan platform
          <span className="num text-[13px] font-extrabold text-astra-ink">{formatIDR(order.total)}</span>
          <span className="hidden text-ink-mute/80 sm:inline">· auto-release bila tidak ada sengketa</span>
        </span>
        <span
          className="flex min-w-0 items-center gap-2.5 text-[11px] text-ink-mute"
          title="Berkas mentah tanpa watermark langsung dimusnahkan agar tangkapan layar tidak bisa didaur ulang."
        >
          <IconLock size={14} className="shrink-0 text-info" />
          <span className="num truncate text-ink-dim">{watermark}</span>
        </span>
      </div>
    </div>
  );
}
