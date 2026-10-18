"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";

/** Square output in px. 512 keeps a sharp retina avatar well under the 500KB cap. */
const OUTPUT = 512;
/** On-screen crop viewport, in CSS px. */
const VIEW = 288;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface Natural {
  w: number;
  h: number;
}

/**
 * Cover scale for a given zoom. Zoom 1 is the smallest fill, so the frame can
 * never show empty corners and panning always has something to clamp against.
 */
function scaleOf(natural: Natural, zoom: number): number {
  return Math.max(VIEW / natural.w, VIEW / natural.h) * zoom;
}

/** Keep the drawn image covering the frame: each edge stays outside [0, VIEW]. */
function clampOffset(natural: Natural, zoom: number, x: number, y: number) {
  const scale = scaleOf(natural, zoom);
  return {
    x: Math.min(0, Math.max(VIEW - natural.w * scale, x)),
    y: Math.min(0, Math.max(VIEW - natural.h * scale, y)),
  };
}

function centeredOffset(natural: Natural, zoom: number) {
  const scale = scaleOf(natural, zoom);
  return { x: (VIEW - natural.w * scale) / 2, y: (VIEW - natural.h * scale) / 2 };
}

/**
 * Square avatar cropper: drag to reposition, slider to zoom.
 *
 * The preview and the exported canvas share `scaleOf`, so what the frame shows
 * is exactly what gets saved. Output is always JPEG at OUTPUT×OUTPUT, which is
 * also how an oversized phone photo lands under the server's 500KB limit.
 */
export function AvatarCropper({
  file,
  busy,
  onCancel,
  onConfirm,
}: {
  file: File;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const [natural, setNatural] = useState<Natural | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Object URL for the picked file. `useMemo` (not an effect) so it is stable
  // across renders and available on the very first paint; the effect below only
  // revokes it. Revoking happens when the URL changes or the cropper unmounts.
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    imgRef.current = img;
    const dims: Natural = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(dims);
    setOffset(centeredOffset(dims, MIN_ZOOM));
  }, []);

  function onZoom(next: number) {
    setZoom(next);
    if (natural) setOffset((prev) => clampOffset(natural, next, prev.x, prev.y));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !natural) return;
    setOffset(clampOffset(natural, zoom, drag.ox + (event.clientX - drag.x), drag.oy + (event.clientY - drag.y)));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function confirm() {
    const img = imgRef.current;
    if (!img || !natural) {
      setError("Gambar belum siap. Coba lagi.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Peramban tidak mendukung pemrosesan gambar.");
      return;
    }
    const k = OUTPUT / VIEW;
    const scale = scaleOf(natural, zoom);
    ctx.fillStyle = "#0d0d11";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, offset.x * k, offset.y * k, natural.w * scale * k, natural.h * scale * k);
    onConfirm(canvas.toDataURL("image/jpeg", 0.85));
  }

  const scale = natural ? scaleOf(natural, zoom) : 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-line bg-paper p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold text-ink">Atur foto profil</span>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onCancel}
            className="grid size-7 place-items-center rounded-full text-ink-dim transition-colors hover:bg-canvas hover:text-ink"
          >
            <IconX size={15} />
          </button>
        </div>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-well bg-canvas-2 outline outline-1 -outline-offset-1 outline-line"
          style={{ width: VIEW, height: VIEW, cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset.
            <img
              src={src}
              alt="Pratinjau foto profil"
              onLoad={handleLoad}
              draggable={false}
              // Absolutely positioned so the frame has no inline-baseline gap;
              // translate() pans it inside the clipped box.
              className="absolute left-0 top-0"
              style={{
                width: natural ? natural.w * scale : VIEW,
                height: natural ? natural.h * scale : VIEW,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                maxWidth: "none",
              }}
            />
          ) : null}
        </div>

        <label className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-ink-dim">Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => onZoom(Number(event.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-astra"
            aria-label="Zoom foto"
          />
        </label>

        <p className="text-[11px] text-ink-mute">
          Geser foto untuk mengatur posisi, atau gunakan slider untuk memperbesar.
        </p>
        {error ? <span className="text-[11px] font-bold text-danger">{error}</span> : null}

        <div className="flex gap-2.5">
          <Button fullWidth disabled={busy} onClick={confirm}>
            {busy ? "Menyimpan..." : "Simpan foto"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            Batal
          </Button>
        </div>
      </div>
    </div>
  );
}