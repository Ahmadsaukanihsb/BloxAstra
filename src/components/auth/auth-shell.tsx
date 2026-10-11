"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { formatIDR } from "@/lib/format";
import { TIER_DAILY_CAPS } from "@/lib/order-meta";
import { AstraMark, IconBell, IconCheck, IconLock, IconUpload } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, OptionCard, TextInput } from "@/components/ui/field";
import { Notice, ProgressBar } from "@/components/ui/feedback";
import { loginAction, registerBuyerAction, registerSellerAction } from "@/app/actions/auth";
import {
  IconAlert,
  IconGoogle,
  IconDiscord,
  IconEye,
  IconEyeOff,
  IconScanFace,
  IconSealCheck,
  IconShieldCheck,
  IconUsers,
} from "@/components/ui/icons";

const KYC_NOTE = `VERIFIKASI PENJUAL BLOX ASTRA
Username: [Username Akun Penjual]
Tanggal: [YYYY-MM-DD]
Pernyataan: Saya bertanggung jawab penuh atas barang yang saya jual.`;

export function AuthPanel({ mode }: { mode: "login" | "register" }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-between gap-10 border-b border-hairline p-7 md:p-10 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6">
          <span className="flex items-center gap-2.5 text-astra-ink">
            <AstraMark size={28} />
            <span className="font-display text-base font-extrabold tracking-tight text-ink">
              Blox<span className="text-astra-ink">Astra</span>
            </span>
          </span>

          <h2 className="max-w-[24ch] font-display text-[1.7rem] font-extrabold leading-[1.08] text-ink md:text-[2.1rem]">
            {mode === "login"
              ? "Dana kamu dijaga sistem, bukan dijaga keberuntungan."
              : "Buka toko dengan identitas yang bisa dipertanggungjawabkan."}
          </h2>

          <p className="max-w-[46ch] text-[13px] leading-relaxed text-ink-dim">
            {mode === "login"
              ? "Semua transaksi lewat penahanan dana dan setiap pesanan punya ruang chat serta bukti serah terima ber-watermark."
              : "Verifikasi identitas manual memastikan tidak ada akun burner yang bisa menguras dana pembeli lalu kabur setelah sanksi."}
          </p>

          <div className="flex flex-col gap-3">
            {(mode === "login"
              ? [
                  { icon: IconShieldCheck, text: "Dana ditahan platform sampai kamu konfirmasi." },
                  { icon: IconBell, text: "Notifikasi orderan masuk ke kotak masuk akun Blox Astra." },
                  { icon: IconLock, text: "Kredensial pesanan dienkripsi dan dihapus otomatis 7 hari." },
                ]
              : [
                  { icon: IconScanFace, text: "Wajib KTP asli + selfie memegang KTP." },
                  { icon: IconSealCheck, text: "Kertas bertuliskan username dan tanggal wajib terlihat." },
                  {
                    icon: IconUsers,
                    text: `Tier 1 dibatasi ${formatIDR(TIER_DAILY_CAPS[1])} per hari sampai terbukti.`,
                  },
                ]
            ).map((item) => (
              <div key={item.text} className="flex items-start gap-3 text-[12px] text-ink-dim">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-canvas text-astra-ink">
                  <item.icon size={15} />
                </span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-7 md:p-10">
        {mode === "login" ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}

function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, {});
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-xl font-extrabold text-ink">Masuk ke akun</h1>
        <p className="text-[12px] text-ink-mute">
          Gunakan email atau username yang terdaftar. Pembeli, penjual, dan admin
          masuk dari pintu yang sama — sistem mengarahkan sesuai peran akunmu.
        </p>
      </div>

      {/* ─── Social Login ─── */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2.5">
          <Link
            href="/api/auth/start/google"
            className="flex flex-1 items-center justify-center gap-2.5 rounded-full border border-line bg-paper px-4 py-3 text-[13px] font-bold text-ink transition-all duration-300 ease-[var(--ease-astra)] hover:border-line-strong hover:bg-canvas active:scale-[0.98]"
          >
            <IconGoogle size={18} />
            Google
          </Link>
          <Link
            href="/api/auth/start/discord"
            className="flex flex-1 items-center justify-center gap-2.5 rounded-full border border-line bg-paper px-4 py-3 text-[13px] font-bold text-ink transition-all duration-300 ease-[var(--ease-astra)] hover:border-[#5865F2]/40 hover:bg-[#5865F2]/[0.06] active:scale-[0.98]"
          >
            <IconDiscord size={18} />
            Discord
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-[11px] font-medium text-ink-mute">atau masuk manual</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <Field
          label="Email atau username"
          htmlFor="identifier"
          error={state.fieldErrors?.identifier}
        >
          <TextInput
            id="identifier"
            name="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="pembeli@bloxastra"
            autoComplete="username"
            invalid={Boolean(state.fieldErrors?.identifier || state.error)}
          />
        </Field>

        <Field label="Kata sandi" htmlFor="password" error={state.fieldErrors?.password}>
          <div className="relative">
            <TextInput
              id="password"
              name="password"
              type={reveal ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-12"
              invalid={Boolean(state.fieldErrors?.password || state.error)}
            />
            <button
              type="button"
              onClick={() => setReveal((value) => !value)}
              aria-pressed={reveal}
              aria-label={reveal ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-ink-mute transition-colors duration-300 hover:text-ink"
            >
              {reveal ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
        </Field>

        {state.error ? (
          <Notice tone="danger" icon={<IconAlert size={15} />}>
            {state.error}
          </Notice>
        ) : null}

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={isPending}
          leadingIcon={<IconShieldCheck size={16} />}
        >
          {isPending ? "Memverifikasi…" : "Masuk ke akun"}
        </Button>
      </form>

      <Notice tone="info" icon={<IconBell size={15} />} title="Notifikasi kamir">
        Semua kabar orderan, sengketa, dan penarikan masuk ke kotak masuk di dalam akun Blox Astra.
      </Notice>

      <p className="border-t border-hairline pt-5 text-[11px] text-ink-mute">
        Belum punya akun?{" "}
        <Link href="/daftar" className="text-astra-ink underline decoration-dotted underline-offset-4">
          Daftar sebagai pembeli atau penjual
        </Link>
      </p>
    </div>
  );
}

function RegisterForm() {
  const [buyerState, buyerAction, buyerPending] = useActionState(registerBuyerAction, {});
  const [sellerState, sellerAction, sellerPending] = useActionState(registerSellerAction, {});
  const [role, setRole] = useState<"buyer" | "seller">("seller");
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [sellerUsername, setSellerUsername] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [noteCopied, setNoteCopied] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const sellerSteps = ["Data akun", "Verifikasi KYC", "Aturan penjual"];
  const kycReady = Boolean(idCardImage) && Boolean(selfieImage);

  async function pickDoc(file: File | undefined, set: (url: string | null) => void) {
    if (!file) return;
    setDocError(null);
    if (!file.type.startsWith("image/")) {
      setDocError("File harus berupa gambar.");
      return;
    }
    if (file.size > 1_000_000) {
      setDocError(`"${file.name}" melebihi 1MB — kompres dulu sebelum unggah.`);
      return;
    }
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!url) {
      setDocError("Gagal membaca file. Coba lagi.");
      return;
    }
    set(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-xl font-extrabold text-ink">Buat akun Blox Astra</h1>
        <p className="text-[12px] text-ink-mute">
          Akun pembeli aktif langsung. Akun penjual menunggu verifikasi identitas manual.
        </p>
      </div>

      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Peran akun">
        <OptionCard
          selected={role === "buyer"}
          onSelect={() => setRole("buyer")}
          title="Saya pembeli"
          description="Belanja Robux, item, Gift Card, akun, dan Premium dengan penahanan dana."
        />
        <OptionCard
          selected={role === "seller"}
          onSelect={() => setRole("seller")}
          title="Saya penjual"
          description="Butuh verifikasi KYC dan lolos penjenjangan tier sebelum bisa menjual."
        />
      </div>

      {role === "seller" ? (
        <form action={sellerAction} className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-2">
            {sellerSteps.map((label, index) => (
              <div key={label} className="flex flex-col gap-2">
                <ProgressBar value={index < step ? 1 : index === step ? 0.5 : 0} />
                <span
                  className={cx(
                    "text-[10px]",
                    index === step ? "text-astra-ink" : index < step ? "text-ink-dim" : "text-ink-mute",
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {step === 0 ? (
            <div className="flex flex-col gap-4">
              <Field
                label="Email"
                htmlFor="seller-email"
                error={sellerState.fieldErrors?.email}
              >
                <TextInput
                  id="seller-email"
                  name="email"
                  type="email"
                  value={sellerEmail}
                  onChange={(event) => setSellerEmail(event.target.value)}
                  placeholder="nama@email.com"
                  invalid={Boolean(sellerState.fieldErrors?.email)}
                />
              </Field>
              <Field
                label="Username"
                htmlFor="seller-username"
                hint="Huruf, angka, dan garis bawah."
                error={sellerState.fieldErrors?.username}
              >
                <TextInput
                  id="seller-username"
                  name="username"
                  value={sellerUsername}
                  onChange={(event) => setSellerUsername(event.target.value)}
                  placeholder="rangga_pradipta"
                  invalid={Boolean(sellerState.fieldErrors?.username)}
                />
              </Field>
              <Field
                label="Kata sandi"
                htmlFor="seller-password"
                hint="Minimal 8 karakter dengan angka."
                error={sellerState.fieldErrors?.password}
              >
                <TextInput
                  id="seller-password"
                  name="password"
                  type="password"
                  value={sellerPassword}
                  onChange={(event) => setSellerPassword(event.target.value)}
                  placeholder="••••••••"
                  invalid={Boolean(sellerState.fieldErrors?.password)}
                />
              </Field>
              <Field label="Nama lengkap sesuai KTP" htmlFor="full-name" error={sellerState.fieldErrors?.fullName}>
                <TextInput
                  id="full-name"
                  name="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Rangga Pradipta"
                  invalid={Boolean(sellerState.fieldErrors?.fullName)}
                />
              </Field>
              <Field label="Nama toko" htmlFor="store-name" hint="Maksimal 100 karakter, harus unik." error={sellerState.fieldErrors?.storeName}>
                <TextInput
                  id="store-name"
                  name="storeName"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="VaultNusantara"
                  invalid={Boolean(sellerState.fieldErrors?.storeName)}
                />
              </Field>
              <Field label="Nomor WhatsApp" htmlFor="phone" hint="Dipakai admin untuk koordinasi verifikasi identitas." error={sellerState.fieldErrors?.whatsapp}>
                <TextInput
                  id="phone"
                  name="whatsapp"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d+]/g, ""))}
                  placeholder="+62 812 3456 7890"
                  className="num"
                  invalid={Boolean(sellerState.fieldErrors?.whatsapp)}
                />
              </Field>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <Notice tone="warn" icon={<IconAlert size={15} />} title="Foto KTP mandiri tidak diterima">
                Kami menolak unggahan KTP tanpa selfie karena berkas semacam itu lazim berasal dari
                kebocoran data internet.
              </Notice>

              {[
                {
                  label: "Unggah foto KTP asli",
                  value: idCardImage,
                  set: setIdCardImage,
                  inputId: "kyc-idcard",
                  hint: "Tidak terpotong, tidak terhalang cahaya. Maks 1MB.",
                },
                {
                  label: "Unggah selfie memegang KTP + kertas catatan",
                  value: selfieImage,
                  set: setSelfieImage,
                  inputId: "kyc-selfie",
                  hint: "Wajah, KTP, dan tulisan tangan harus terbaca jelas dalam satu frame. Maks 1MB.",
                },
              ].map((item) => (
                <div key={item.label}>
                  <input
                    id={item.inputId}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      void pickDoc(event.target.files?.[0], item.set);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById(item.inputId)?.click()}
                    className={cx(
                      "flex w-full items-start gap-3.5 rounded-2xl border border-dashed p-4 text-left transition-colors duration-300 ease-[var(--ease-astra)]",
                      item.value
                        ? "border-astra/40 bg-astra/[0.06]"
                        : "border-line-strong bg-canvas hover:bg-canvas",
                    )}
                  >
                    <span
                      className={cx(
                        "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
                        item.value ? "bg-astra/15 text-astra-ink" : "bg-canvas text-ink-dim",
                      )}
                    >
                      {item.value ? <IconCheck size={16} /> : <IconUpload size={16} />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[13px] text-ink">{item.label}</span>
                      <span className="text-[11px] leading-relaxed text-ink-mute">{item.hint}</span>
                      <span className="num mt-1 text-[10px] text-ink-mute">
                        {item.value ? "terlampirkan — klik untuk ganti" : "belum ada berkas"}
                      </span>
                    </span>
                    {item.value ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.value}
                        alt={item.label}
                        className="size-16 shrink-0 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-line"
                      />
                    ) : null}
                  </button>
                </div>
              ))}
              {docError ? (
                <p className="text-xs font-bold text-danger">{docError}</p>
              ) : null}

              <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-mute">
                  Tulisan tangan wajib pada kertas
                </span>
                <pre className="num overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-dim">
                  {KYC_NOTE}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  onClick={() => setNoteCopied(true)}
                >
                  {noteCopied ? "Format disalin" : "Salin format catatan"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2.5">
              {[
                {
                  label: `Penjual baru dibatasi ${formatIDR(TIER_DAILY_CAPS[1])} per hari sampai terbukti.`,
                  tier: "Tier 1",
                },
                { label: "Peningkatan tier beserta plafonnya ditinjau admin berdasarkan performa toko — bukan otomatis.", tier: "Tier 1" },
                { label: "Akses rebutan orderan pool baru terbuka setelah Tier 2.", tier: "Tier 2" },
                { label: "Rasio sengketa ditinjau admin saat pertimbangan naik/turun tier.", tier: "Tier 2" },
              ].map((rule) => (
                  <div
                    key={rule.label}
                    className="flex items-start gap-3 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
                  >
                    <Badge tone="astra">{rule.tier}</Badge>
                    <span className="text-[12px] leading-relaxed text-ink-dim">{rule.label}</span>
                  </div>
                ))}
              </div>

              <Checkbox
                id="seller-agree"
                checked={agreed}
                onChange={setAgreed}
                label="Saya bertanggung jawab penuh atas barang yang saya jual dan menyetujui aturan penahanan dana"
                description="Pelanggaran berat membuat identitas dilaporkan ke basis data fraud dan rekening pencairan masuk daftar hitam permanen."
              />
            </div>
          ) : null}

          {/* Carry step-0 values into FormData — those inputs unmount on later steps. */}
          {step > 0 ? (
            <>
              <input type="hidden" name="email" value={sellerEmail} readOnly />
              <input type="hidden" name="username" value={sellerUsername} readOnly />
              <input type="hidden" name="password" value={sellerPassword} readOnly />
              <input type="hidden" name="fullName" value={fullName} readOnly />
              <input type="hidden" name="storeName" value={storeName} readOnly />
              <input type="hidden" name="whatsapp" value={phone} readOnly />
              {idCardImage ? <input type="hidden" name="idCardImage" value={idCardImage} readOnly /> : null}
              {selfieImage ? <input type="hidden" name="selfieImage" value={selfieImage} readOnly /> : null}
              {agreed ? <input type="hidden" name="agreed" value="on" readOnly /> : null}
            </>
          ) : null}

          {sellerState.error ? (
            <Notice tone="danger" icon={<IconAlert size={15} />}>
              {sellerState.error}
            </Notice>
          ) : null}

          <div className="flex flex-col gap-2.5 border-t border-hairline pt-5 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <Button variant="ghost" type="button" onClick={() => setStep((value) => value - 1)}>
                Kembali
              </Button>
            ) : (
              <ButtonLink href="/masuk" variant="ghost">
                Sudah punya akun
              </ButtonLink>
            )}

            {step < 2 ? (
              <Button
                size="lg"
                type="button"
                disabled={
                  step === 0
                    ? fullName.trim().length < 3 ||
                      storeName.trim().length < 3 ||
                      phone.length < 8 ||
                      sellerEmail.trim().length < 5 ||
                      sellerUsername.trim().length < 3 ||
                      sellerPassword.length < 8
                    : !kycReady
                }
                onClick={() => setStep((value) => value + 1)}
              >
                {step === 0 ? "Lanjut ke KYC" : "Lanjut ke aturan"}
              </Button>
            ) : (
              <Button size="lg" type="submit" disabled={!agreed || sellerPending} trailingIcon={<IconCheck size={16} />}>
                {sellerPending ? "Membuat akun…" : "Kirim pendaftaran penjual"}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2.5">
              <Link
                href="/api/auth/start/google"
                className="flex flex-1 items-center justify-center gap-2.5 rounded-full border border-line bg-paper px-4 py-3 text-[13px] font-bold text-ink transition-all duration-300 ease-[var(--ease-astra)] hover:border-line-strong hover:bg-canvas active:scale-[0.98]"
              >
                <IconGoogle size={18} />
                Daftar dengan Google
              </Link>
            </div>
            <Link
              href="/api/auth/start/discord"
              className="flex items-center justify-center gap-2.5 rounded-full border border-line bg-paper px-4 py-3 text-[13px] font-bold text-ink transition-all duration-300 ease-[var(--ease-astra)] hover:border-[#5865F2]/40 hover:bg-[#5865F2]/[0.06] active:scale-[0.98]"
            >
              <IconDiscord size={18} />
              Daftar dengan Discord
            </Link>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-hairline" />
              <span className="text-[11px] font-medium text-ink-mute">atau isi manual</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>
          </div>

          <form action={buyerAction} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="buyer-email" error={buyerState.fieldErrors?.email}>
              <TextInput
                id="buyer-email"
                name="email"
                type="email"
                placeholder="nama@email.com"
                invalid={Boolean(buyerState.fieldErrors?.email)}
              />
            </Field>
            <Field
              label="Username"
              htmlFor="buyer-username"
              hint="Huruf, angka, dan garis bawah. Muncul di riwayat transaksi."
              error={buyerState.fieldErrors?.username}
            >
              <TextInput
                id="buyer-username"
                name="username"
                placeholder="rangga_pradipta"
                invalid={Boolean(buyerState.fieldErrors?.username)}
              />
            </Field>
            <Field label="Nomor WhatsApp" htmlFor="buyer-phone" error={buyerState.fieldErrors?.whatsapp}>
              <TextInput
                id="buyer-phone"
                name="whatsapp"
                placeholder="+62 812 3456 7890"
                className="num"
                invalid={Boolean(buyerState.fieldErrors?.whatsapp)}
              />
            </Field>
            <Field
              label="Kata sandi"
              htmlFor="buyer-password"
              hint="Minimal 8 karakter dengan angka."
              error={buyerState.fieldErrors?.password}
            >
              <TextInput
                id="buyer-password"
                name="password"
                type="password"
                placeholder="••••••••"
                invalid={Boolean(buyerState.fieldErrors?.password)}
              />
            </Field>
            {buyerState.error ? (
              <Notice tone="danger" icon={<IconAlert size={15} />}>
                {buyerState.error}
              </Notice>
            ) : null}
            <Button size="lg" fullWidth type="submit" disabled={buyerPending} trailingIcon={<IconCheck size={16} />}>
              {buyerPending ? "Membuat akun…" : "Daftar sebagai pembeli"}
            </Button>
          </form>
          <p className="text-[11px] leading-relaxed text-ink-mute">
            Dengan mendaftar kamu menyetujui aturan penahanan dana dan kebijakan sengketa. Verifikasi
            identitas penjual memakai KTP asli + selfie, ditinjau manual oleh admin.
          </p>
        </div>
      )}
    </div>
  );
}
