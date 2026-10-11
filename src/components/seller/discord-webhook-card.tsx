"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSellerWebhook,
  saveSellerWebhook,
  setSellerWebhookEnabled,
  testSellerWebhook,
} from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { IconAlert, IconCheck, IconDiscord, IconX } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/**
 * Seller-owned Discord webhook for pool-race pings. The full URL never
 * renders back — only a masked tail proving one is stored.
 */
export function DiscordWebhookCard({
  configured,
  masked,
  enabled,
  disabled,
}: {
  configured: boolean;
  masked: string | null;
  enabled: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: () => void) {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      done?.();
      router.refresh();
    });
  }

  function save() {
    const value = url.trim();
    if (!value) {
      setError("Tempel dulu URL webhook channel Discord kamu.");
      return;
    }
    run(() => saveSellerWebhook({ url: value }), () => {
      setUrl("");
      setFlash("Webhook tersimpan. Mulai sekarang order pool masuk ke Discord kamu.");
    });
  }

  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-4 p-5">
        <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <IconDiscord size={16} className="text-astra-ink" />
          Notifikasi Discord
        </span>
        <p className="text-[11px] leading-relaxed text-ink-mute">
          Setiap order pool yang lunas langsung diteruskan ke channel Discord-mu. Siapa cepat dia
          dapat, tanpa perlu menatap papan rebutan.
        </p>

        {error ? (
          <Notice tone="danger" icon={<IconAlert size={15} />}>
            {error}
          </Notice>
        ) : null}
        {flash ? (
          <Notice tone="astra" icon={<IconCheck size={15} />}>
            {flash}
          </Notice>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-well bg-canvas px-4 py-3 outline outline-1 -outline-offset-1 outline-line">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12px] font-bold text-ink">
              {configured ? "Terpasang" : "Belum dipasang"}
            </span>
            <span className="num truncate text-[10px] text-ink-mute">
              {masked ?? "tidak ada URL tersimpan"}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={disabled || isPending || !configured}
            onClick={() => run(() => setSellerWebhookEnabled(!enabled))}
            className={cx(
              "relative grid h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-40",
              enabled ? "bg-astra" : "bg-canvas-2",
            )}
          >
            <span
              className={cx(
                "absolute size-5 rounded-full bg-paper shadow transition-all duration-300",
                enabled ? "right-1" : "left-1",
              )}
            />
          </button>
        </div>

        <Field
          label="URL webhook channel"
          htmlFor="discord-webhook-url"
          hint="Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL."
        >
          <TextInput
            id="discord-webhook-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            inputMode="url"
            autoComplete="off"
          />
        </Field>

        <div className="flex flex-wrap gap-2.5">
          <Button size="sm" disabled={disabled || isPending || url.trim().length === 0} onClick={save}>
            {isPending ? "Menyimpan…" : configured ? "Ganti URL" : "Pasang webhook"}
          </Button>
          {configured ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled || isPending}
                onClick={() =>
                  run(() => testSellerWebhook(), () => setFlash("Ping terkirim. Cek channel Discord kamu."))
                }
              >
                Tes ping
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled || isPending}
                onClick={() => run(() => deleteSellerWebhook())}
                leadingIcon={<IconX size={14} />}
              >
                Hapus
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
