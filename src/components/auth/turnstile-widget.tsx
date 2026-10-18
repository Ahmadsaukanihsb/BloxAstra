"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile checkbox, explicit render. Drops its token into
 * `cf-turnstile-response` for the surrounding server-action form.
 * Renders nothing when no site key is configured (local dev).
 */
export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerId = `turnstile-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [token, setToken] = useState("");
  const widgetId = useRef<string | null>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!siteKey || rendered.current) return;
    let cancelled = false;
    let attempts = 0;
    // The API script loads lazily; poll briefly rather than racing it.
    const timer = setInterval(() => {
      if (cancelled) return;
      attempts += 1;
      if (window.turnstile && !rendered.current) {
        rendered.current = true;
        clearInterval(timer);
        try {
          widgetId.current = window.turnstile.render(`#${containerId}`, {
            sitekey: siteKey,
            callback: (next: string) => setToken(next),
            "expired-callback": () => setToken(""),
            "error-callback": () => setToken(""),
          });
        } catch {
          rendered.current = false;
        }
      } else if (attempts > 100) {
        clearInterval(timer);
      }
    }, 100);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (widgetId.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* already gone */
        }
      }
      widgetId.current = null;
      rendered.current = false;
    };
  }, [siteKey, containerId]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
      />
      <div className="flex justify-center">
        <div id={containerId} />
      </div>
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
    </>
  );
}
