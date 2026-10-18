"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VERDICT_LABEL, type PlusEligibilityReport, type SignalState } from "@/lib/roblox-plus";
import { formatDateTime } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { DataRow, ListFrame, RecordFrame } from "@/components/admin/console";
import { IconAlert, IconCheck, IconCrown, IconRefresh, IconShieldCheck } from "@/components/ui/icons";

/**
 * Roblox Plus trial eligibility check.
 *
 * This panel reads; it does not claim. Roblox publishes no endpoint that
 * creates, claims or extends a consumer subscription, so the claim stays a
 * manual click in a browser that is already signed in — and this panel says so
 * on screen rather than leaving an operator to assume a button did it.
 *
 * The cookie is never stored. It lives in component state for one round trip,
 * is cleared the moment the report comes back, and goes nowhere near the audit
 * trail (which records the verdict and signals instead). It is posted to a route
 * handler rather than a server action on purpose: Next.js logs server-action
 * arguments in full, and a logged cookie is a stored cookie.
 */

const SIGNAL_LABEL: Record<SignalState, string> = {
  ya: "Ada",
  tidak: "Tidak",
  tidak_terbaca: "Tidak terbaca",
};

/** Roblox answers with a translation key; operators should read an age band. */
function ageGroupLabel(key: string | null): string {
  if (!key) return "tidak terbaca";
  const raw = key.replace(/^Label\./, "");
  const bands: Record<string, string> = {
    AgeGroupOver21: "21+",
    AgeGroup18To20: "18–20",
    AgeGroup16To17: "16–17",
    AgeGroup13To15: "13–15",
    AgeGroup9To12: "9–12",
    AgeGroup5To8: "5–8",
  };
  return bands[raw] ?? raw;
}

function signalTone(state: SignalState): "success" | "neutral" | "warn" {
  if (state === "ya") return "success";
  if (state === "tidak") return "neutral";
  return "warn";
}

export function PlusEligibility() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [cookie, setCookie] = useState("");
  const [report, setReport] = useState<PlusEligibilityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runCheck() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/plus-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cookie, username }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { report?: PlusEligibilityReport; error?: string }
        | null;
      if (!response.ok || !payload?.report) {
        setError(payload?.error ?? "Pemeriksaan gagal dijalankan. Coba lagi.");
        setReport(null);
        return;
      }
      setReport(payload.report);
      // The credential has done its one job. Dropping it here — rather than at
      // the next submit — is what makes "kami tidak menyimpannya" checkable.
      setCookie("");
      router.refresh();
    } catch {
      // An action that rejects must still release the button, or the panel sits
      // disabled with no message and no way back.
      setError("Pemeriksaan gagal dijalankan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const ready = cookie.trim().length > 0 && !pending;

  return (
    <div className="flex flex-col gap-6">
      <Notice tone="warn" icon={<IconAlert size={15} />} title="Klaim tetap dilakukan manual">
        Panel ini hanya membaca sinyal dari akun. Tidak ada API Roblox yang bisa mengklaim atau
        mengaktifkan langganan, jadi setelah verdict keluar, klik klaim di
        <span className="num"> roblox.com/plus </span>
        dilakukan di browser pelanggan yang sudah login — dan langganan itu menagih metode
        pembayaran mereka sendiri setelah masa gratisnya berakhir.
      </Notice>

      <RecordFrame>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="astra" icon={<IconShieldCheck size={13} />}>
              Cookie dipakai sekali
            </Badge>
            <span className="text-[11px] text-ink-mute">
              nilai cookie tidak disimpan, tidak dicatat di audit, dan dibuang setelah pemeriksaan
              selesai
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Field
              label="Username akun (opsional)"
              hint="Kalau diisi, sesi harus cocok dengan username ini. Salah akun akan diteriakkan di hasil."
              htmlFor="plus-username"
            >
              <TextInput
                id="plus-username"
                value={username}
                autoComplete="off"
                spellCheck={false}
                placeholder="rangga_pradipta"
                onChange={(event) => setUsername(event.target.value)}
              />
            </Field>

            <Field
              label="Cookie .ROBLOSECURITY pelanggan"
              hint="Tempel nilai cookie-nya saja — awalan .ROBLOSECURITY=, tanda kutip, dan spasi akan dibersihkan."
              htmlFor="plus-cookie"
            >
              <TextArea
                id="plus-cookie"
                value={cookie}
                autoComplete="off"
                spellCheck={false}
                rows={3}
                className="num min-h-[84px] text-[11px]"
                placeholder="_|WARNING:-DO-NOT-SHARE-THIS.|_…"
                onChange={(event) => setCookie(event.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={!ready}
              leadingIcon={pending ? <IconRefresh size={14} /> : <IconCrown size={14} />}
              onClick={runCheck}
            >
              {pending ? "Membaca akun…" : "Cek kelayakan"}
            </Button>
            {report || error ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReport(null);
                  setError(null);
                  setCookie("");
                }}
              >
                Bersihkan hasil
              </Button>
            ) : null}
          </div>
        </div>
      </RecordFrame>

      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Pemeriksaan tidak selesai">
          {error}
        </Notice>
      ) : null}

      {report ? <PlusReport report={report} /> : null}
    </div>
  );
}

function PlusReport({ report }: { report: PlusEligibilityReport }) {
  const badgeTone: "warn" | "danger" | "muted" =
    report.verdict === "kemungkinan_eligible" ? "warn" : report.verdict === "sesi_tidak_valid" ? "danger" : "muted";
  const railTone = report.verdict === "kemungkinan_eligible" ? "warn" : report.verdict === "sesi_tidak_valid" ? "danger" : "neutral";

  return (
    <div className="flex flex-col gap-5">
      <RecordFrame tone={railTone}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={badgeTone} icon={<IconCrown size={13} />}>
                {VERDICT_LABEL[report.verdict]}
              </Badge>
              {report.usernameMatches === false ? (
                <Badge tone="danger" icon={<IconAlert size={13} />}>
                  Sesi bukan akun yang diketik
                </Badge>
              ) : null}
              {report.usernameMatches === true ? (
                <Badge tone="success" icon={<IconCheck size={13} />}>
                  Username cocok
                </Badge>
              ) : null}
            </div>
            <span className="num text-[11px] text-ink-mute">
              {report.verdict === "kemungkinan_eligible"
                ? "sinyal ditemukan — bukan konfirmasi dari Roblox"
                : report.verdict === "tidak_ada_sinyal"
                  ? "tidak ada sinyal positif yang terbaca"
                  : "tidak ada akun yang bisa dibaca"}
            </span>
          </div>

          <ListFrame>
            <div className="flex flex-col gap-1.5 p-4">
              <DataRow label="Akun" value={report.account ? report.account.username : "tidak terbaca"} />
              {report.account ? (
                <>
                  <DataRow label="Nama tampilan" value={report.account.displayName || "—"} />
                  <DataRow label="User ID" value={String(report.account.id)} />
                </>
              ) : null}
            </div>
          </ListFrame>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <span className="eyebrow text-ink-mute">Sinyal akun</span>
              <ListFrame>
                <div className="flex flex-col gap-1.5 p-4">
                  <DataRow
                    label="Premium aktif"
                    value={SIGNAL_LABEL[report.signals.premium]}
                    tone={signalTone(report.signals.premium)}
                  />
                  <DataRow
                    label="Precheck upsell"
                    value={SIGNAL_LABEL[report.signals.upsellPrecheck]}
                    tone={signalTone(report.signals.upsellPrecheck)}
                  />
                  <DataRow
                    label="Riwayat langganan (rute lama)"
                    value={SIGNAL_LABEL[report.signals.subscriptionRows]}
                    tone={signalTone(report.signals.subscriptionRows)}
                  />
                  {/* The landing page's own answer — the strongest signal here,
                      since it is what decides whether "Try it for free" shows. */}
                  <DataRow
                    label="Tawaran Plus dari Roblox"
                    value={
                      report.plusAccess.access
                        ? `${SIGNAL_LABEL[report.signals.plusPrompt]} · ${report.plusAccess.access}`
                        : SIGNAL_LABEL[report.signals.plusPrompt]
                    }
                    tone={signalTone(report.signals.plusPrompt)}
                  />
                </div>
              </ListFrame>

              {/* Age status belongs next to the offer, not inside its verdict: one
                  is a marketing gate, the other a safety gate. */}
              <span className="eyebrow mt-2 text-ink-mute">Verifikasi usia</span>
              <ListFrame>
                <div className="flex flex-col gap-1.5 p-4">
                  <DataRow label="Grup usia" value={ageGroupLabel(report.age.groupKey)} />
                  <DataRow
                    label="Sudah dicek Roblox"
                    value={
                      report.age.checked === null ? "Tidak terbaca" : report.age.checked ? "Ya" : "Belum"
                    }
                    tone={report.age.checked ? "success" : "neutral"}
                  />
                  <DataRow
                    label="Estimasi usia"
                    value={report.age.estimatedAge !== null ? `${report.age.estimatedAge} tahun` : "—"}
                  />
                  <DataRow
                    label="Verifikasi ID pemerintah"
                    value={
                      report.age.idVerified === null ? "Tidak terbaca" : report.age.idVerified ? "Sudah" : "Belum"
                    }
                    tone={report.age.idVerified ? "success" : "neutral"}
                  />
                </div>
              </ListFrame>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="eyebrow text-ink-mute">
                Pesan inbox yang menyebut Plus ({report.offers.length})
              </span>
              {report.offers.length ? (
                <ListFrame>
                  <div className="divide-y divide-line">
                    {report.offers.map((offer) => (
                      <div key={offer.id} className="flex items-start justify-between gap-3 p-4">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-[12px] font-bold text-ink">{offer.subject}</span>
                          <span className="num text-[11px] text-ink-mute">
                            #{offer.id}
                            {offer.sentAt ? ` · ${formatDateTime(offer.sentAt)}` : ""}
                          </span>
                        </div>
                        {offer.trialMention ? (
                          <Badge tone="warn">trial</Badge>
                        ) : (
                          <Badge tone="muted">sebut Plus</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ListFrame>
              ) : (
                <ListFrame>
                  <div className="p-4 text-[12px] leading-relaxed text-ink-mute">
                    Tidak ada pesan yang menyebut Plus di 25 pesan inbox pertama. Tawaran trial dikirim
                    Roblox lewat inbox dan email, jadi kotak masuk yang bersih berarti tawaran itu tidak
                    terlihat di sini.
                  </div>
                </ListFrame>
              )}
            </div>
          </div>
        </div>
      </RecordFrame>

      <ListFrame>
        <div className="flex flex-col gap-2 p-4">
          <span className="eyebrow text-ink-mute">Catatan pemeriksaan</span>
          <ul className="flex flex-col gap-2">
            {report.notes.map((note) => (
              <li key={note} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-dim">
                <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-line-strong" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      </ListFrame>

      <div className="flex flex-wrap items-center gap-2.5">
        <ButtonLink
          href="https://www.roblox.com/plus"
          target="_blank"
          rel="noreferrer"
          variant="secondary"
          size="sm"
          leadingIcon={<IconCrown size={14} />}
        >
          Buka halaman Plus
        </ButtonLink>
        <ButtonLink
          href="https://www.roblox.com/my/messages/#!/inbox"
          target="_blank"
          rel="noreferrer"
          variant="ghost"
          size="sm"
        >
          Buka inbox akun
        </ButtonLink>
      </div>
    </div>
  );
}
