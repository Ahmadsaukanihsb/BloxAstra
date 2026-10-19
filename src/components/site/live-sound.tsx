"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLiveStream } from "@/lib/live";
import { cx } from "@/lib/cx";
import { IconVolume, IconVolumeMuted } from "@/components/ui/icons";

/**
 * Sound layer for the live channel.
 *
 * Two moments deserve a ring and nothing else does: a claimable order landing
 * in the rebutan pool (every open seller dashboard hears it the instant the
 * buyer's payment settles) and a person writing in an order room (the
 * counterpart hears a soft blip; the sender's own tabs stay quiet). Status
 * moves — shipped, confirmed, refunded — arrive on the same stream without a
 * meta, so they refresh the room silently.
 *
 * The tones are synthesised with Web Audio instead of shipped as files: no
 * asset to load, nothing to license, and each channel keeps its own voice.
 * Browsers refuse to play audio before the first user gesture, so the context
 * is created/‑resumed on the first pointer or key event of the visit; a sound
 * that fires before any interaction is simply skipped — the toast and the
 * instant refetch still land.
 */

const STORAGE_KEY = "bloxastra:sound";

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audio) return audio;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audio = new Ctor();
  } catch {
    return null;
  }
  return audio;
}

export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function note(
  ctx: AudioContext,
  freq: number,
  at: number,
  duration: number,
  gain: number,
  type: OscillatorType,
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = ctx.currentTime + at;
  // Exponential ramps need a non-zero floor; a near-silent start would click.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function play(tones: Array<{ freq: number; at: number; duration: number }>, gain: number, type: OscillatorType) {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  for (const tone of tones) note(ctx, tone.freq, tone.at, tone.duration, gain, type);
}

/** Two soft rising notes — a chat bubble, not an alarm. */
function playChatBlip() {
  play(
    [
      { freq: 659, at: 0, duration: 0.13 },
      { freq: 880, at: 0.09, duration: 0.18 },
    ],
    0.12,
    "sine",
  );
}

/** Three rising notes — money on the table deserves attention. */
function playPoolChime() {
  play(
    [
      { freq: 784, at: 0, duration: 0.15 },
      { freq: 988, at: 0.13, duration: 0.15 },
      { freq: 1319, at: 0.26, duration: 0.3 },
    ],
    0.2,
    "triangle",
  );
}

/** Renders nothing; plays the channel's sounds. Mounted for signed-in users. */
export function LiveSound() {
  useLiveStream(["pool", "room"], (topic, meta) => {
    if (!soundEnabled()) return;
    if (topic === "pool" && meta === "arrived") playPoolChime();
    else if (topic === "room" && meta === "message") playChatBlip();
  });

  // Browsers only allow audio after an interaction; this unlocks the context
  // on the first gesture so later pushes are audible.
  useEffect(() => {
    const unlock = () => {
      const ctx = context();
      if (ctx && ctx.state === "suspended") void ctx.resume();
    };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, []);

  return null;
}

/**
 * Speaker switch beside the bell. The choice lives in localStorage and is read
 * at ring time, so flipping it applies to the very next event without
 * remounting the stream. `useSyncExternalStore` reads it as external state —
 * including a flip made in another tab, via the browser's `storage` event.
 */
const preferenceListeners = new Set<() => void>();

function subscribePreference(callback: () => void): () => void {
  preferenceListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    preferenceListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function preferenceSnapshot(): string {
  return soundEnabled() ? "on" : "off";
}

function preferenceServerSnapshot(): string {
  return "on";
}

function writePreference(next: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    /* private mode - the session keeps whatever it had */
  }
  for (const listener of preferenceListeners) listener();
}

export function SoundToggle() {
  const on = useSyncExternalStore(subscribePreference, preferenceSnapshot, preferenceServerSnapshot) === "on";

  function toggle() {
    const next = !on;
    writePreference(next);
    // Turning it on gives an immediate confirmation blip (and satisfies the
    // browser's gesture requirement for later sounds).
    if (next) playChatBlip();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Matikan suara notifikasi" : "Nyalakan suara notifikasi"}
      title={on ? "Suara notifikasi aktif" : "Suara notifikasi mati"}
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-200 hover:bg-canvas",
        on ? "text-ink-dim hover:text-ink" : "text-ink-mute hover:text-ink-dim",
      )}
    >
      {on ? <IconVolume size={19} /> : <IconVolumeMuted size={19} />}
    </button>
  );
}
