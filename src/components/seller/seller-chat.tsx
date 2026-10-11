"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendSellerChatMessage } from "@/app/actions/seller";
import type { SellerChatItem } from "@/lib/seller";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { IconAlert, IconChat, IconUsers } from "@/components/ui/icons";

export function SellerChatBox({ messages }: { messages: SellerChatItem[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message — but only when the reader is
  // already near the bottom, so polling never yanks away history reading.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    if (nearBottom) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  // Light polling keeps the room alive without websockets.
  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const result = await sendSellerChatMessage({ body });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal mengirim">
          {error}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-2 text-[13px] text-ink-mute">
          <IconUsers size={15} className="text-astra-ink" />
          {messages.length} pesan di ruang ini
        </span>
        <span className="text-[11px] text-ink-mute">
          Ruang ini dibaca semua penjual. Jangan bagikan data sensitif.
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex h-[min(58vh,460px)] flex-col gap-3 overflow-y-auto rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
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
          messages.map((message) => (
            <div
              key={message.id}
              className={cx("flex max-w-[85%] flex-col gap-1", message.isSelf && "self-end")}
            >
              <div
                className={cx(
                  "rounded-well px-3.5 py-2.5 outline outline-1 -outline-offset-1",
                  message.isSelf
                    ? "bg-astra/10 text-ink outline-astra/25"
                    : "bg-paper text-ink outline-line",
                )}
              >
                <p className="text-[12px] leading-relaxed break-words whitespace-pre-wrap">
                  {message.body}
                </p>
              </div>
              <span className="num flex items-center gap-1.5 px-1 text-[10px] text-ink-mute">
                <span className="font-bold text-ink-dim">
                  {message.isSelf ? "kamu" : message.storeName ?? message.username}
                </span>
                {formatDateTime(message.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2.5">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Tulis pesan untuk sesama penjual… (Enter untuk kirim, Shift+Enter untuk baris baru)"
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
      <p className="num text-right text-[10px] text-ink-mute">{draft.length}/1000</p>
    </div>
  );
}
