"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSellerChatMessage,
  editSellerChatMessage,
  fetchSellerChatRevision,
  markSellerChatSeen,
  reportSellerChatMessage,
  sendSellerChatMessage,
} from "@/app/actions/seller";
import { useLiveRevision, useLiveStream } from "@/lib/live";
import type { SellerChatItem, SellerChatQuote, SellerChatUnread } from "@/lib/seller";
import { useChatPresence, type OnlineSeller } from "@/lib/chat-presence";
import {
  mentionQueryAt,
  mentionSuggestions,
  segmentMentions,
  type MentionTarget,
} from "@/lib/mentions";
import { cx } from "@/lib/cx";
import { formatChatDay, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { SellerAvatar } from "@/components/ui/art";
import {
  IconAlert,
  IconAt,
  IconChat,
  IconCheckCircle,
  IconFlag,
  IconPencil,
  IconReply,
  IconTrash,
  IconUsers,
  IconX,
} from "@/components/ui/icons";

const AVATAR_SIZE = 34;

/** Report reasons — the labels live with the action, the keys with the server. */
const REPORT_REASONS = [
  { key: "spam", label: "Spam" },
  { key: "kasar", label: "Kasar / penipuan" },
  { key: "pribadi", label: "Data pribadi" },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]["key"];

interface Notice {
  tone: "danger" | "astra";
  title: string;
  body: string;
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

/** The name a message is filed under: the shop, or the account behind it. */
function senderName(message: SellerChatItem): string {
  const name = message.storeName ?? message.username;
  return message.isSelf ? "kamu" : name;
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

/**
 * Where this visit starts. In astra, unlike the quiet day separators: this is
 * the one line in the room that is about the reader, not about the room.
 */
function NewDivider({ count }: { count: number }) {
  return (
    <div className="my-4 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-astra-ink">
      <span className="h-px flex-1 bg-astra/40" />
      {count === 1 ? "1 pesan baru" : `${count} pesan baru`}
      <span className="h-px flex-1 bg-astra/40" />
    </div>
  );
}

/** Message text with the shops it calls out picked out in astra. */
function MessageBody({ body, mentionable }: { body: string; mentionable: MentionTarget[] }) {
  return (
    <>
      {segmentMentions(body, mentionable).map((segment, index) =>
        segment.kind === "mention" ? (
          <span key={index} className="font-bold text-astra-ink">
            {segment.text}
          </span>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Who is around right now, from the realtime streams that are already open.
 * Avatars rather than a number: in a room of five shops, recognising the faces
 * is the whole point.
 */
function Presence({ online }: { online: OnlineSeller[] }) {
  if (online.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-ink-mute">
        <span className="size-2 rounded-full bg-line" />
        Belum ada penjual lain yang online
      </span>
    );
  }
  const shown = online.slice(0, 4);
  const rest = online.length - shown.length;
  return (
    <span
      className="flex items-center gap-2"
      title={`Sedang online: ${online.map((seller) => seller.name).join(", ")}`}
    >
      <span className="flex items-center -space-x-2">
        {shown.map((seller) => (
          <span key={seller.userId} className="relative">
            <SellerAvatar name={seller.name} size={22} />
            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success outline outline-2 -outline-offset-1 outline-canvas" />
          </span>
        ))}
      </span>
      <span className="num text-[11px] text-ink-mute">
        {online.length} penjual lain online{rest > 0 ? ` (+${rest})` : ""}
      </span>
    </span>
  );
}

/** One button in a message's action row. */
function MessageAction({
  icon,
  label,
  tone = "neutral",
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "neutral" | "danger";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex items-center gap-1 rounded-tag px-2 py-1 text-[11px] font-bold transition-colors duration-200 disabled:opacity-45",
        tone === "danger"
          ? "text-danger hover:bg-danger/10"
          : "text-ink-mute hover:bg-canvas hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** The quote strip a reply carries, inside the bubble above its own text. */
function QuoteStrip({
  quote,
  onJump,
}: {
  quote: SellerChatQuote;
  onJump: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onJump(quote.id)}
      className="mb-2 flex w-full max-w-full flex-col items-start gap-0.5 rounded-tag border-l-2 border-astra/50 bg-canvas/60 px-2 py-1.5 text-left transition-colors hover:bg-canvas"
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-astra-ink">
        {quote.author}
      </span>
      <span className={cx("line-clamp-2 text-[11px] leading-snug", quote.deleted ? "italic text-ink-mute" : "text-ink-dim")}>
        {quote.deleted ? "Pesan ini dihapus" : quote.excerpt}
      </span>
    </button>
  );
}

export function SellerChatBox({
  messages,
  unread,
  mentionable,
  online: initialOnline,
  moderator = false,
}: {
  messages: SellerChatItem[];
  unread: SellerChatUnread;
  mentionable: MentionTarget[];
  online: OnlineSeller[];
  /** Admins may remove anyone's message — the end of a report. */
  moderator?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // "Hari ini"/"Kemarin" cannot be read from the clock during render — that is
  // an impure read. It also refreshes once a minute, so a room left open
  // overnight flips its dividers on its own.
  const [now, setNow] = useState<number | null>(null);

  // The divider belongs to this visit: it is read once on mount and then left
  // alone. A push or poll refresh re-renders the room with a cursor that has
  // already moved past these messages, and without this freeze the line the
  // reader was working from would silently vanish under them.
  const [visit] = useState(unread);
  const firstUnreadId = visit.firstUnreadId;
  const online = useChatPresence(initialOnline);

  // The message a mention notification (or a quote) pointed at, washed in astra
  // for a beat so the reader can see which sentence is meant.
  const [flashId, setFlashId] = useState<string | null>(null);
  const handledHash = useRef("");
  const flashTimer = useRef<number | null>(null);
  const jumpTimer = useRef<number | null>(null);

  // Which message is showing its actions. Set by hovering on a pointer device
  // and by tapping the bubble on a touch screen, where hover does not exist.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<SellerChatQuote | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  // Reports this tab already sent, so the button stops offering a dead end
  // without waiting for a refetch.
  const [reportedIds, setReportedIds] = useState<string[]>([]);

  /** Scroll a message into view and light it up. False when it is not rendered. */
  const flashMessage = useCallback((id: string): boolean => {
    const node = document.getElementById(id);
    if (!node) return false;
    // Instant, not smooth: on a cold load the browser lands on the fragment
    // itself, and two scrolls racing in the same box is how the message ends up
    // somewhere other than where it was announced. The second pass catches a
    // native landing that arrived after this one.
    node.scrollIntoView({ block: "center" });
    if (jumpTimer.current !== null) window.clearTimeout(jumpTimer.current);
    jumpTimer.current = window.setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ block: "center" }),
      260,
    );
    setFlashId(id);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2600);
    return true;
  }, []);

  /** Bring `#chat-<id>` into view. No-op for anything else — an unrelated hash
   *  must never move the reader — and reports whether it found the message. */
  const jumpToHash = useCallback((): boolean => {
    const hash = window.location.hash;
    if (!hash.startsWith("#chat-")) return false;
    return flashMessage(hash.slice(1));
  }, [flashMessage]);

  /** Jump to a quoted message and make the jump shareable. */
  const jumpToQuote = useCallback(
    (messageId: string) => {
      const hash = `#chat-${messageId}`;
      if (!flashMessage(hash.slice(1))) return;
      // Marked as handled so the URL watcher below does not jump a second time.
      handledHash.current = hash;
      // `history.state` is preserved: the App Router keeps its own bookkeeping
      // there, and replacing it with null breaks back/forward.
      window.history.replaceState(window.history.state, "", hash);
    },
    [flashMessage],
  );

  // ————— mention menu —————
  const [caret, setCaret] = useState(0);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const query = mentionQueryAt(draft, caret);
  const suggestions = query ? mentionSuggestions(mentionable, query.query) : [];
  const menuOpen = query !== null && suggestions.length > 0 && dismissedQuery !== query.query;
  // The highlighted row is stored with the query it belongs to, so a new
  // letter starts the highlight over at the top without an effect to reset it.
  const queryKey = query ? `${query.at}:${query.query}` : "";
  const [highlight, setHighlight] = useState({ key: "", index: 0 });
  const activeIndex =
    highlight.key === queryKey ? Math.min(highlight.index, Math.max(0, suggestions.length - 1)) : 0;

  const newestId = messages[messages.length - 1]?.id ?? null;

  useEffect(() => {
    const sync = () => setNow(Date.now());
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Remember this visit. Runs on mount and again whenever a newer message
  // lands while the room is open — those have been seen on screen, so the next
  // visit should not be told about them.
  useEffect(() => {
    if (!newestId) return;
    void markSellerChatSeen();
  }, [newestId]);

  // A mention links to `#chat-<id>`. The browser cannot honour that hash on its
  // own: the room streams in after the page and scrolls inside its own box, not
  // the window. Watching the URL is what makes it work in every case — a cold
  // load whose messages land late, a plain `hashchange`, and Next's own client
  // navigation (clicking a second mention while the room is already open) which
  // changes the URL without firing `hashchange` at all. Each hash is honoured
  // once; if the message is not rendered yet the watcher keeps trying.
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      if (hash === handledHash.current) return;
      if (jumpToHash()) handledHash.current = hash;
    };
    sync();
    window.addEventListener("hashchange", sync);
    const timer = window.setInterval(sync, 500);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.clearInterval(timer);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      if (jumpTimer.current !== null) window.clearTimeout(jumpTimer.current);
    };
  }, [jumpToHash]);

  // Auto-scroll to the newest message — but only when the reader is
  // already near the bottom, so polling never yanks away history reading.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    if (nearBottom) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  // Push first: the server notifies this tab as soon as anyone posts, so the
  // room updates without a reload and without waiting out a poll interval.
  useLiveStream(["chat"], () => router.refresh());

  // Fallback loop. It asks for a tiny revision (message count + newest id)
  // instead of blindly re-rendering, and it also re-checks the moment this tab
  // comes back to the foreground — exactly when a throttled background timer
  // used to leave the room looking frozen until a reload.
  useLiveRevision({
    read: fetchSellerChatRevision,
    intervalMs: 30_000,
    onChange: (_revision, previous) => {
      // First sample is the state this page already rendered with.
      if (!previous) return;
      router.refresh();
    },
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setNotice(null);
    const result = await sendSellerChatMessage({ body, replyToId: replyingTo?.id });
    setSending(false);
    if (!result.ok) {
      setNotice({ tone: "danger", title: "Gagal mengirim", body: result.error });
      return;
    }
    setDraft("");
    setCaret(0);
    setReplyingTo(null);
    router.refresh();
  }

  async function saveEdit(messageId: string) {
    const body = editDraft.trim();
    if (!body) return;
    setBusyId(messageId);
    setNotice(null);
    const result = await editSellerChatMessage({ id: messageId, body });
    setBusyId(null);
    if (!result.ok) {
      setNotice({ tone: "danger", title: "Gagal menyimpan", body: result.error });
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function confirmDelete(messageId: string) {
    setBusyId(messageId);
    setNotice(null);
    const result = await deleteSellerChatMessage({ id: messageId });
    setBusyId(null);
    setConfirmDeleteId(null);
    if (!result.ok) {
      setNotice({ tone: "danger", title: "Gagal menghapus", body: result.error });
      return;
    }
    setActiveId(null);
    router.refresh();
  }

  async function sendReport(messageId: string, reason: ReportReason) {
    setBusyId(messageId);
    setNotice(null);
    const result = await reportSellerChatMessage({ id: messageId, reason });
    setBusyId(null);
    setReportingId(null);
    if (!result.ok) {
      setNotice({ tone: "danger", title: "Laporan gagal", body: result.error });
      return;
    }
    setReportedIds((ids) => [...ids, messageId]);
    setNotice({
      tone: "astra",
      title: "Laporan terkirim ke admin",
      body: "Admin menerima pesan lengkapnya beserta tautan ke pesan ini.",
    });
  }

  function startReply(message: SellerChatItem) {
    setReplyingTo({
      id: message.id,
      // The shop name, not "kamu": the quote bar is read as a caption of the
      // message being answered, and "Membalas kamu" would be nonsense.
      author: message.storeName ?? message.username,
      excerpt: message.body.replace(/\s+/g, " ").trim().slice(0, 140),
      deleted: message.deleted,
    });
    setActiveId(null);
    setReportingId(null);
    setConfirmDeleteId(null);
    setNotice(null);
    composerRef.current?.focus();
  }

  function startEdit(message: SellerChatItem) {
    setEditingId(message.id);
    setEditDraft(message.body);
    setReportingId(null);
    setConfirmDeleteId(null);
    setNotice(null);
  }

  function applyMention(target: MentionTarget) {
    if (!query) return;
    const label = target.storeName ?? target.username;
    const next = `${draft.slice(0, query.at)}@${label} ${draft.slice(caret)}`;
    const nextCaret = query.at + label.length + 2;
    setDraft(next);
    setCaret(nextCaret);
    setDismissedQuery(null);
    // Put the caret after the inserted name so a second @ follows naturally.
    requestAnimationFrame(() => {
      const node = composerRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight({ key: queryKey, index: (activeIndex + 1) % suggestions.length });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight({
          key: queryKey,
          index: (activeIndex - 1 + suggestions.length) % suggestions.length,
        });
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedQuery(query?.query ?? null);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyMention(suggestions[activeIndex]);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <Notice
          tone={notice.tone}
          icon={notice.tone === "astra" ? <IconCheckCircle size={15} /> : <IconAlert size={15} />}
          title={notice.title}
        >
          {notice.body}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-2 text-[13px] text-ink-mute">
          <IconUsers size={15} className="text-astra-ink" />
          {messages.length} pesan di ruang ini
        </span>
        {visit.count > 0 ? (
          <Badge tone="astra" icon={<IconAt size={12} />}>
            {visit.count} pesan baru
          </Badge>
        ) : null}
        <Presence online={online} />
        <span className="text-[11px] text-ink-mute">
          Ruang ini dibaca semua penjual. Jangan bagikan data sensitif.
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex h-[min(58vh,460px)] flex-col overflow-y-auto rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
      >
        {messages.length === 0 ? (
          <div className="m-auto flex max-w-[36ch] flex-col items-center gap-3 text-center">
            <span className="grid size-12 place-items-center rounded-well text-ink-mute">
              <IconChat size={22} />
            </span>
            <p className="text-[13px] font-bold text-ink">Belum ada pesan</p>
            <p className="text-[12px] leading-relaxed text-ink-mute">
              Sapa penjual lain, tanya stok, atau koordinasi rebutan order Robux di sini.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
            // Consecutive messages from one sender read as one block: the
            // avatar and name print once, at the top of it.
            const startsBlock = newDay || !previous || previous.username !== message.username;
            const endsBlock =
              !next || next.username !== message.username || dayKey(next.createdAt) !== dayKey(message.createdAt);
            const name = senderName(message);
            const isActive = activeId === message.id;
            const isEditing = editingId === message.id;
            const isBusy = busyId === message.id;
            const alreadyReported = reportedIds.includes(message.id);

            return (
              <Fragment key={message.id}>
                {message.id === firstUnreadId ? <NewDivider count={visit.count} /> : null}
                {newDay && now !== null ? <DayDivider label={formatChatDay(message.createdAt, now)} /> : null}
                <div
                  id={`chat-${message.id}`}
                  onMouseEnter={() => setActiveId((current) => (current === message.id ? current : message.id))}
                  className={cx(
                    "flex w-full items-end gap-2.5 rounded-well transition-colors duration-700",
                    message.isSelf ? "justify-end" : "justify-start",
                    startsBlock && !newDay ? "mt-3" : "mt-0.5",
                    flashId === `chat-${message.id}` ? "bg-astra/[0.07]" : "bg-transparent",
                  )}
                >
                  {/* Others read left, with their shop identity visible. */}
                  {message.isSelf ? null : (
                    <span className="w-[34px] shrink-0">
                      {startsBlock ? (
                        <SellerAvatar name={name} size={AVATAR_SIZE} imageUrl={message.storeImage} />
                      ) : null}
                    </span>
                  )}

                  <div className="flex min-w-0 max-w-[min(78%,30rem)] flex-col gap-1">
                    {startsBlock ? (
                      <span
                        className={cx(
                          "px-1 text-[10px] font-extrabold",
                          message.isSelf ? "text-right text-ink-mute" : "text-astra-ink",
                        )}
                      >
                        {name}
                      </span>
                    ) : null}

                    {isEditing ? (
                      <div className="flex w-[min(78vw,26rem)] flex-col gap-2 rounded-well bg-paper p-2.5 outline outline-1 -outline-offset-1 outline-astra/40">
                        <textarea
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditingId(null);
                            }
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                              event.preventDefault();
                              void saveEdit(message.id);
                            }
                          }}
                          rows={3}
                          maxLength={1000}
                          autoFocus
                          className="w-full resize-none rounded-tag bg-canvas px-3 py-2 text-[12px] text-ink outline outline-1 -outline-offset-1 outline-line focus:outline-astra/40"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-ink-mute">
                            Esc batal · Ctrl+Enter simpan
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                            >
                              Batal
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isBusy || editDraft.trim().length === 0}
                              onClick={() => void saveEdit(message.id)}
                            >
                              {isBusy ? "Menyimpan…" : "Simpan"}
                            </Button>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        // Set, never toggle: on a pointer device the hover above
                        // has already opened this row, and a click that closed it
                        // would make the buttons unreachable by mouse.
                        onClick={() => setActiveId(message.id)}
                        className={cx(
                          "rounded-well px-3.5 py-2.5 text-[12px] leading-relaxed break-words whitespace-pre-wrap outline outline-1 -outline-offset-1",
                          "w-fit max-w-full",
                          message.isSelf
                            ? "rounded-br-[6px] bg-astra/15 text-ink outline-astra/30"
                            : "rounded-bl-[6px] bg-paper text-ink outline-line",
                          isActive && "cursor-default",
                        )}
                      >
                        {message.replyTo ? (
                          <QuoteStrip quote={message.replyTo} onJump={jumpToQuote} />
                        ) : null}
                        {message.deleted ? (
                          <span className="flex items-center gap-1.5 italic text-ink-mute">
                            <IconTrash size={13} />
                            Pesan ini dihapus
                          </span>
                        ) : (
                          <MessageBody body={message.body} mentionable={mentionable} />
                        )}
                      </div>
                    )}

                    {endsBlock ? (
                      <span
                        className={cx(
                          "num flex items-center gap-1.5 px-1 text-[10px] text-ink-mute",
                          message.isSelf ? "justify-end" : "justify-start",
                        )}
                      >
                        {formatDateTime(message.createdAt)}
                        {message.edited && !message.deleted ? <span>· diedit</span> : null}
                      </span>
                    ) : null}

                    {isActive && !isEditing ? (
                      <div
                        className={cx(
                          "flex flex-wrap items-center gap-1",
                          message.isSelf ? "justify-end" : "justify-start",
                        )}
                      >
                        {confirmDeleteId === message.id ? (
                          <>
                            <span className="px-1 text-[11px] font-bold text-danger">Hapus pesan ini?</span>
                            <MessageAction
                              tone="danger"
                              icon={<IconTrash size={13} />}
                              label={isBusy ? "Menghapus…" : "Ya, hapus"}
                              disabled={isBusy}
                              onClick={() => void confirmDelete(message.id)}
                            />
                            <MessageAction
                              icon={<IconX size={13} />}
                              label="Batal"
                              onClick={() => setConfirmDeleteId(null)}
                            />
                          </>
                        ) : reportingId === message.id ? (
                          <>
                            <span className="px-1 text-[11px] font-bold text-ink-dim">Lapor ke admin:</span>
                            {REPORT_REASONS.map((reason) => (
                              <MessageAction
                                key={reason.key}
                                tone="danger"
                                icon={<IconFlag size={13} />}
                                label={reason.label}
                                disabled={isBusy}
                                onClick={() => void sendReport(message.id, reason.key)}
                              />
                            ))}
                            <MessageAction
                              icon={<IconX size={13} />}
                              label="Batal"
                              onClick={() => setReportingId(null)}
                            />
                          </>
                        ) : (
                          <>
                            <MessageAction
                              icon={<IconReply size={13} />}
                              label="Balas"
                              onClick={() => startReply(message)}
                            />
                            {message.isSelf && !message.deleted ? (
                              <>
                                <MessageAction
                                  icon={<IconPencil size={13} />}
                                  label="Edit"
                                  onClick={() => startEdit(message)}
                                />
                                <MessageAction
                                  tone="danger"
                                  icon={<IconTrash size={13} />}
                                  label="Hapus"
                                  onClick={() => setConfirmDeleteId(message.id)}
                                />
                              </>
                            ) : null}
                            {/* An admin can remove anyone's message — that is
                                where a report ends. Editing someone else's
                                words stays nobody's right. */}
                            {!message.isSelf && moderator && !message.deleted ? (
                              <MessageAction
                                tone="danger"
                                icon={<IconTrash size={13} />}
                                label="Hapus"
                                onClick={() => setConfirmDeleteId(message.id)}
                              />
                            ) : null}
                            {!message.isSelf && !moderator && !message.deleted ? (
                              <MessageAction
                                tone={alreadyReported ? "neutral" : "danger"}
                                icon={<IconFlag size={13} />}
                                label={alreadyReported ? "Sudah dilaporkan" : "Lapor"}
                                disabled={alreadyReported}
                                onClick={() => setReportingId(message.id)}
                              />
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* ...and yours read right, so the two sides never blur. */}
                  {message.isSelf ? (
                    <span className="w-[34px] shrink-0">
                      {startsBlock ? <SellerAvatar name={message.storeName ?? message.username} size={AVATAR_SIZE} imageUrl={message.storeImage} /> : null}
                    </span>
                  ) : null}
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-2">
        {replyingTo ? (
          <div className="flex items-center gap-2.5 rounded-well bg-paper px-3 py-2 outline outline-1 -outline-offset-1 outline-line">
            <IconReply size={15} className="shrink-0 text-astra-ink" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-astra-ink">
                Membalas {replyingTo.author}
              </span>
              <span className="truncate text-[11px] text-ink-dim">
                {replyingTo.deleted ? "Pesan ini dihapus" : replyingTo.excerpt}
              </span>
            </span>
            <button
              type="button"
              aria-label="Batal membalas"
              onClick={() => setReplyingTo(null)}
              className="grid size-7 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
            >
              <IconX size={15} />
            </button>
          </div>
        ) : null}

        <div className="relative">
          {menuOpen ? (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(100%,24rem)] overflow-hidden rounded-well bg-canvas p-1.5 shadow-[0_18px_40px_-24px_rgba(23,21,46,0.45)] outline outline-1 -outline-offset-1 outline-line">
              <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-mute">
                Sebut toko lain
              </p>
              <ul className="flex flex-col">
                {suggestions.map((target, index) => (
                  <li key={target.userId}>
                    <button
                      type="button"
                      // Keep the caret in the textarea when the mouse lands here.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyMention(target)}
                      className={cx(
                        "flex w-full items-center gap-2.5 rounded-tag px-2.5 py-2 text-left transition-colors",
                        index === activeIndex ? "bg-astra/10" : "hover:bg-canvas",
                      )}
                    >
                      <SellerAvatar name={target.storeName ?? target.username} size={24} imageUrl={target.storeImage} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[12.5px] font-bold text-ink">
                          {target.storeName ?? target.username}
                        </span>
                        <span className="truncate text-[11px] text-ink-mute">@{target.username}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="px-2.5 pt-1 pb-1.5 text-[10px] text-ink-mute">
                ↑↓ pilih · Enter sisipkan · Esc tutup
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex items-end gap-2.5">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setCaret(event.target.selectionStart);
              }}
              onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Tulis pesan… ketik @ untuk menyebut toko lain (Enter kirim, Shift+Enter baris baru)"
              rows={1}
              maxLength={1000}
              className="min-h-[44px] w-full resize-none rounded-well bg-canvas px-4 py-3 text-[13px] text-ink outline outline-1 -outline-offset-1 outline-line placeholder:text-ink-mute focus:outline-astra/40"
            />
            <Button
              type="submit"
              size="md"
              disabled={sending || draft.trim().length === 0}
              className="shrink-0"
            >
              {sending ? "Mengirim…" : "Kirim"}
            </Button>
          </form>
        </div>
      </div>
      <p className="num text-right text-[10px] text-ink-mute">{draft.length}/1000</p>
    </div>
  );
}
