"use client";

/**
 * Client-side image compression for uploads.
 *
 * The admin panels cap uploads hard (160KB for the four homepage cards, because
 * all four ride inside the homepage payload; 500KB for the header logo). Asking
 * an admin to manually squash a phone photo before every swap is a bad trade, so
 * this shrinks the image for them at the moment of choosing.
 *
 * Why WebP first: it keeps an alpha channel (the card artwork wants transparent
 * logos) *and* compresses 5–10× smaller than PNG, which is what makes a 460KB
 * source fit under a 160KB budget without visibly degrading a logo.
 *
 * GIF is left alone on purpose: a canvas redraw would flatten an animation to a
 * single frame, so an oversized GIF is refused rather than silently destroyed.
 */

/** Exact decoded byte count of a data URL (base64 pads the last group). */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  if (b64.length === 0) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

interface Loaded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadImage(file: File): Promise<Loaded | null> {
  // createImageBitmap decodes off the main thread and handles EXIF orientation.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * Re-encode `file` until it fits under `maxBytes`, or return null when even the
 * smallest attempt is too big (a very large, very noisy photo can hit that).
 *
 * Walks scale down first, then quality: dropping a 1024px logo to 768px is
 * invisible at the ~62px display size, while dropping quality to 0.5 is not —
 * so resolution is spent before fidelity.
 */
export async function compressImageFile(file: File, maxBytes: number): Promise<string | null> {
  // An animated GIF cannot survive a canvas round-trip.
  if (file.type === "image/gif") return null;

  const loaded = await loadImage(file);
  if (!loaded) return null;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const scales = [1, 0.85, 0.7, 0.55, 0.42, 0.32];
    const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];

    for (const scale of scales) {
      const w = Math.max(1, Math.round(loaded.width * scale));
      const h = Math.max(1, Math.round(loaded.height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(loaded.source, 0, 0, w, h);

      for (const quality of qualities) {
        const webp = canvas.toDataURL("image/webp", quality);
        // Safari without WebP encode silently returns a PNG data URL; skip it so
        // the loop does not "succeed" with a format that is still too large.
        if (webp.startsWith("data:image/webp") && dataUrlBytes(webp) <= maxBytes) {
          return webp;
        }
        const jpeg = canvas.toDataURL("image/jpeg", quality);
        if (dataUrlBytes(jpeg) <= maxBytes) return jpeg;
      }
    }
    return null;
  } finally {
    loaded.release();
  }
}
