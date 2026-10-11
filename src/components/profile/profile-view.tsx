"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatIDR, formatDateTime } from "@/lib/format";
import { updateProfile, updateAvatar, changePassword } from "@/app/actions/profile";
import { requestWhatsappOtp, verifyWhatsappOtp } from "@/app/actions/whatsapp";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/field";
import {
  IconArrowRight,
  IconCheckCircle,
  IconDiscord,
  IconGoogle,
  IconHexCoin,
  IconLogout,
  IconPackage,
  IconReceipt,
  IconShieldCheck,
  IconUpload,
  IconUserSquare,
} from "@/components/ui/icons";
import type { ProfileView } from "@/lib/profile";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  discord: "Discord",
};

const PROVIDER_ICONS: Record<string, typeof IconGoogle> = {
  google: IconGoogle,
  discord: IconDiscord,
};

function roleLabel(role: ProfileView["role"]) {
  switch (role) {
    case "admin":
      return "Admin";
    case "seller":
      return "Penjual";
    default:
      return "Pembeli";
  }
}

const LINK_ERROR_MESSAGE: Record<string, string> = {
  taken: "Akun provider tersebut sudah tertaut ke akun Blox Astra lain.",
  oauth_session: "Sesi berakhir saat menautkan. Masuk lagi lalu ulangi.",
  oauth_exchange: "Gagal menghubungi provider. Coba lagi sebentar lagi.",
  oauth_state: "Sesi penautan kedaluwarsa. Ulangi dari tombol Tautkan.",
};

export function ProfileView({
  profile,
  linkNotice,
  linkable,
}: {
  profile: ProfileView;
  linkNotice: { linked: string | null; linkError: string | null };
  linkable: { google: boolean; discord: boolean };
}) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username);
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [changing, setChanging] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [waPhone, setWaPhone] = useState(profile.whatsapp ?? "");
  const [waCode, setWaCode] = useState("");
  const [waSent, setWaSent] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarDraft, setAvatarDraft] = useState<string | null | undefined>(undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const initials = profile.username.slice(0, 2).toUpperCase();
  const shownAvatar = avatarDraft === undefined ? profile.avatarUrl : avatarDraft;

  function pickAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarMsg(null);
    if (!file.type.startsWith("image/")) {
      setAvatarMsg({ ok: false, text: "File harus berupa gambar." });
      return;
    }
    if (file.size > 500_000) {
      setAvatarMsg({ ok: false, text: "Foto maksimal 500KB. Kompres dulu." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarDraft(String(reader.result));
    reader.onerror = () => setAvatarMsg({ ok: false, text: "Gagal membaca file." });
    reader.readAsDataURL(file);
  }

  async function saveAvatar(image: string | null) {
    setAvatarBusy(true);
    setAvatarMsg(null);
    const result = await updateAvatar({ image });
    setAvatarBusy(false);
    if (!result.ok) {
      setAvatarMsg({ ok: false, text: result.error ?? "Gagal menyimpan foto." });
      return;
    }
    setAvatarDraft(undefined);
    router.refresh();
  }

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const result = await updateProfile({ username, whatsapp });
    setSavingProfile(false);
    if (result.ok) {
      setProfileMsg({ ok: true, text: "Profil berhasil diperbarui." });
      router.refresh();
    } else {
      setProfileMsg({ ok: false, text: result.error ?? "Gagal menyimpan." });
    }
  }

  async function handleSendOtp(event: React.FormEvent) {
    event.preventDefault();
    setWaBusy(true);
    setWaMsg(null);
    const result = await requestWhatsappOtp({ phone: waPhone });
    setWaBusy(false);
    if (!result.ok) {
      setWaMsg({ ok: false, text: result.error });
      return;
    }
    setWaSent(true);
    setWaCode("");
    setWaMsg({
      ok: true,
      text: result.simCode
        ? `Mode simulasi. Kode verifikasimu: ${result.simCode}. Di produksi kode dikirim via WhatsApp.`
        : "Kode 6 digit dikirim via WhatsApp. Berlaku 5 menit.",
    });
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setWaBusy(true);
    setWaMsg(null);
    const result = await verifyWhatsappOtp({ code: waCode });
    setWaBusy(false);
    if (!result.ok) {
      setWaMsg({ ok: false, text: result.error });
      return;
    }
    setWaMsg({ ok: true, text: "Nomor WhatsApp terverifikasi." });
    router.refresh();
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setChanging(true);
    setPwdMsg(null);
    const result = await changePassword({ current: currentPwd, next: newPwd });
    setChanging(false);
    if (result.ok) {
      setCurrentPwd("");
      setNewPwd("");
      setPwdMsg({ ok: true, text: "Kata sandi berhasil diubah." });
    } else {
      setPwdMsg({ ok: false, text: result.error ?? "Gagal mengubah kata sandi." });
    }
  }

  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-mute">
            <IconUserSquare size={16} className="text-astra-ink" />
            Akun saya
          </span>
 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
            Profil saya
          </h1>
          <p className="max-w-[66ch] text-[13px] leading-relaxed text-ink-dim">
            Kelola identitas akun, kata sandi, dan metode masuk yang tertaut ke Blox Astra.
          </p>
        </div>

        <div className="bezel-shell bg-astra/[0.03] p-1.5">
          <div className="bezel-core flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="relative">
                {shownAvatar ? (
                  // Provider avatar / upload preview — plain img avoids remote-pattern config.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shownAvatar}
                    alt={`Foto ${profile.username}`}
                    width={64}
                    height={64}
                    className="size-16 rounded-well object-cover outline outline-1 -outline-offset-1 outline-line"
                  />
                ) : (
                  <span className="grid size-16 place-items-center rounded-well bg-astra/15 text-xl font-extrabold text-astra-ink">
                    {initials}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Ganti foto profil"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 grid size-7 place-items-center rounded-full bg-astra text-white shadow transition-colors duration-200 hover:bg-astra-bright"
                >
                  <IconUpload size={13} />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  aria-label="Pilih foto profil"
                  onChange={(event) => {
                    pickAvatar(event.target.files?.[0] ?? undefined);
                    event.target.value = "";
                  }}
                />
              </div>
              {avatarDraft !== undefined ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => void saveAvatar(avatarDraft)}
                    className="rounded-full bg-astra px-3 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-astra-bright disabled:opacity-50"
                  >
                    {avatarBusy ? "…" : "Simpan"}
                  </button>
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => {
                      setAvatarDraft(undefined);
                      setAvatarMsg(null);
                    }}
                    className="rounded-full bg-canvas px-3 py-1 text-[11px] font-bold text-ink-dim outline outline-1 -outline-offset-1 outline-line"
                  >
                    Batal
                  </button>
                </div>
              ) : profile.avatarImage ? (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => void saveAvatar(null)}
                  className="text-[11px] font-bold text-danger underline decoration-dotted underline-offset-4"
                >
                  Hapus foto
                </button>
              ) : null}
              {avatarMsg && !avatarMsg.ok ? (
                <span className="max-w-[10rem] text-center text-[10px] font-bold text-danger">
                  {avatarMsg.text}
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[19px] font-extrabold text-ink">
                  {profile.username}
                </span>
                <Badge
                  tone={
                    profile.role === "admin"
                      ? "astra"
                      : profile.role === "seller"
                        ? "warn"
                        : "info"
                  }
                >
                  {roleLabel(profile.role)}
                </Badge>
              </div>
              <div className="flex flex-col gap-1 text-[12px] text-ink-dim sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
                <span className="truncate">{profile.email}</span>
                <span className="flex items-center gap-1.5">
                  WA {profile.whatsapp ?? "—"}
                  {profile.whatsapp ? (
                    <Badge tone={profile.whatsappVerified ? "astra" : "warn"}>
                      {profile.whatsappVerified ? "terverifikasi" : "belum verifikasi"}
                    </Badge>
                  ) : null}
                </span>
                <span className="num">Bergabung {formatDateTime(profile.memberSince)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink
                href="/dompet"
                variant="secondary"
                size="sm"
                leadingIcon={<IconHexCoin size={14} />}
              >
                Dompet
              </ButtonLink>
              <ButtonLink
                href="/pesanan"
                variant="secondary"
                size="sm"
                trailingIcon={<IconArrowRight size={14} />}
              >
                Pesanan
              </ButtonLink>
              {profile.role === "seller" ? (
                <ButtonLink href="/dashboard/penjual" size="sm">
                  Dashboard Penjual
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink">
                <IconReceipt size={16} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Berjalan
                </span>
                <span className="num truncate text-[15px] font-extrabold text-ink">
                  {profile.activeOrders} pesanan
                </span>
                <span className="truncate text-[10px] text-ink-mute">
                  Belum selesai: bayar, proses, kirim, sengketa
                </span>
              </span>
            </div>
          </div>
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink">
                <IconPackage size={16} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Selesai
                </span>
                <span className="num truncate text-[15px] font-extrabold text-ink">
                  {profile.completedOrders} pesanan
                </span>
                <span className="truncate text-[10px] text-ink-mute">
                  Barang sudah diterima penuh
                </span>
              </span>
            </div>
          </div>
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink">
                <IconHexCoin size={16} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Total dibayar
                </span>
                <span className="num truncate text-[15px] font-extrabold text-ink">
                  {formatIDR(profile.paidTotal)}
                </span>
                <span className="truncate text-[10px] text-ink-mute">
                  Di luar yang batal & refund
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-5 p-5">
              <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                <IconUserSquare size={16} className="text-astra-ink" />
                Data pribadi
              </span>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                <Field
                  label="Username"
                  htmlFor="username"
                  error={profileMsg?.ok ? undefined : profileMsg?.text}
                >
                  <TextInput
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                  />
                </Field>
                <Field
                  label="WhatsApp"
                  htmlFor="whatsapp"
                  hint="Dipakai penjual/admin menghubungimu soal pesanan."
                >
                  <TextInput
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </Field>
                {profileMsg?.ok ? (
                  <Notice tone="astra" icon={<IconCheckCircle size={15} />}>
                    {profileMsg.text}
                  </Notice>
                ) : null}
                <div>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? "Menyimpan…" : "Simpan perubahan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-5 p-5">
              <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                <IconShieldCheck size={16} className="text-astra-ink" />
                Keamanan
              </span>
              {!profile.hasPassword ? (
                <Notice tone="info" icon={<IconShieldCheck size={15} />} title="Akun OAuth">
                  Akun ini dibuat lewat Google/Discord. Kata sandi tidak dapat diubah di sini.
                </Notice>
              ) : (
                <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                  <Field label="Kata sandi saat ini" htmlFor="current-password">
                    <TextInput
                      id="current-password"
                      type="password"
                      value={currentPwd}
                      onChange={(event) => setCurrentPwd(event.target.value)}
                      autoComplete="current-password"
                    />
                  </Field>
                  <Field label="Kata sandi baru" htmlFor="new-password">
                    <TextInput
                      id="new-password"
                      type="password"
                      value={newPwd}
                      onChange={(event) => setNewPwd(event.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                  {pwdMsg ? (
                    <Notice
                      tone={pwdMsg.ok ? "astra" : "danger"}
                      icon={<IconCheckCircle size={15} />}
                    >
                      {pwdMsg.text}
                    </Notice>
                  ) : null}
                  <div>
                    <Button type="submit" variant="secondary" disabled={changing}>
                      {changing ? "Mengubah…" : "Ubah kata sandi"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-5 p-5">
            <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
              <IconCheckCircle size={16} className="text-astra-ink" />
              Verifikasi WhatsApp
            </span>
            {profile.whatsappVerified && profile.whatsapp ? (
              <Notice tone="astra" icon={<IconCheckCircle size={15} />}>
                Nomor {profile.whatsapp} sudah terverifikasi. Mengubah nomor di Data Pribadi akan
                menghapus status ini sampai nomor baru diverifikasi.
              </Notice>
            ) : (
              <form onSubmit={waSent ? handleVerifyOtp : handleSendOtp} className="flex flex-col gap-4">
                <Field
                  label="Nomor WhatsApp"
                  htmlFor="wa-phone"
                  hint="Kode 6 digit dikirim ke nomor ini. Berlaku 5 menit, maks 5x salah tebak."
                >
                  <TextInput
                    id="wa-phone"
                    value={waPhone}
                    onChange={(event) => {
                      setWaPhone(event.target.value);
                      setWaSent(false);
                      setWaMsg(null);
                    }}
                    inputMode="tel"
                    placeholder="0812xxxxxxx"
                    disabled={waSent}
                  />
                </Field>
                {waSent ? (
                  <Field label="Kode verifikasi" htmlFor="wa-code">
                    <TextInput
                      id="wa-code"
                      value={waCode}
                      onChange={(event) => setWaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      className="num tracking-[0.3em]"
                      placeholder="••••••"
                    />
                  </Field>
                ) : null}
                {waMsg ? (
                  <Notice
                    tone={waMsg.ok ? "astra" : "danger"}
                    icon={<IconCheckCircle size={15} />}
                  >
                    {waMsg.text}
                  </Notice>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={waBusy}>
                    {waBusy ? "Memproses…" : waSent ? "Verifikasi kode" : "Kirim kode verifikasi"}
                  </Button>
                  {waSent ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={waBusy}
                      onClick={() => {
                        setWaSent(false);
                        setWaCode("");
                        setWaMsg(null);
                      }}
                    >
                      Ganti nomor
                    </Button>
                  ) : null}
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-5 p-5">
            <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
              <IconShieldCheck size={16} className="text-astra-ink" />
              Akun tertaut
            </span>
            <p className="-mt-3 text-[11px] leading-relaxed text-ink-mute">
              Tautkan Google atau Discord supaya bisa masuk tanpa kata sandi. Akun yang tertaut
              hanya bisa dipakai di akun ini.
            </p>
            {linkNotice.linked ? (
              <Notice tone="astra" icon={<IconCheckCircle size={15} />}>
                {linkNotice.linked === "already"
                  ? "Akun tersebut memang sudah tertaut ke akun ini."
                  : `Akun ${(PROVIDER_LABELS[linkNotice.linked] ?? linkNotice.linked).toLowerCase()} berhasil ditautkan. Sekarang bisa masuk lewat provider itu.`}
              </Notice>
            ) : null}
            {linkNotice.linkError ? (
              <Notice tone="danger" icon={<IconShieldCheck size={15} />}>
                {LINK_ERROR_MESSAGE[linkNotice.linkError] ??
                  "Gagal menautkan akun. Coba lagi sebentar lagi."}
              </Notice>
            ) : null}
            {profile.linkedAccounts.length === 0 &&
            !linkable.google &&
            !linkable.discord ? (
              <p className="text-[12px] leading-relaxed text-ink-mute">
                Penautan akun belum diaktifkan oleh admin.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profile.linkedAccounts.map((account) => {
                  const Icon = PROVIDER_ICONS[account.provider] ?? IconGoogle;
                  return (
                    <div
                      key={account.provider}
                      className="flex items-center gap-3 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-paper text-ink outline outline-1 -outline-offset-1 outline-line">
                        <Icon size={19} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[13px] font-bold text-ink">
                          {PROVIDER_LABELS[account.provider] ?? account.provider}
                        </span>
                        <span className="truncate text-[11px] text-ink-dim">
                          {account.email ?? "Tertaut"}
                        </span>
                      </div>
                      <Badge tone="astra">aktif</Badge>
                    </div>
                  );
                })}
                {(["google", "discord"] as const).map((provider) => {
                  const already = profile.linkedAccounts.some(
                    (account) => account.provider === provider,
                  );
                  if (already || !linkable[provider]) return null;
                  const Icon = PROVIDER_ICONS[provider] ?? IconGoogle;
                  return (
                    <div
                      key={`link-${provider}`}
                      className="flex items-center gap-3 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-paper text-ink outline outline-1 -outline-offset-1 outline-line">
                        <Icon size={19} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[13px] font-bold text-ink">
                          {PROVIDER_LABELS[provider] ?? provider}
                        </span>
                        <span className="truncate text-[11px] text-ink-dim">
                          Belum tertaut
                        </span>
                      </div>
                      <a
                        href={`/api/auth/start/${provider}?mode=link`}
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-astra px-4 text-[13px] font-extrabold text-white transition-colors duration-300 hover:bg-astra-bright"
                      >
                        Tautkan
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                <IconLogout size={16} className="text-astra-ink" />
                Sesi perangkat ini
              </span>
              <span className="text-[11px] leading-relaxed text-ink-mute">
                Keluar dari akun di perangkat yang sedang dipakai.
              </span>
            </div>
            <form action="/api/auth/logout" method="get">
              <Button type="submit" variant="secondary">
                Keluar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
