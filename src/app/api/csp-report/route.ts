import { NextResponse, type NextRequest } from "next/server";
import { checkThrottle } from "@/lib/throttle";

const MAX_BODY_BYTES = 8 * 1024;

interface CspReport {
  "document-uri"?: string;
  "violated-directive"?: string;
  "blocked-uri"?: string;
  "line-number"?: number;
  "source-file"?: string;
}

/**
 * Sink for Content-Security-Policy-Report-Only violations. Unauthenticated
 * by design (browsers don't send cookies usefully here), so it is throttled
 * per IP, capped in size, and logs only the identifying fields — never the
 * raw payload. Output lands in PM2 logs for weekly review.
 */
export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    if (!checkThrottle(`csp:${ip}`, 60_000)) {
      return new NextResponse(null, { status: 204 });
    }

    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await request.json().catch(() => null)) as {
      "csp-report"?: CspReport;
    } | null;
    const report = body?.["csp-report"];
    if (report) {
      console.error(
        `[csp] ${report["violated-directive"] ?? "?"} blocked=${report["blocked-uri"] ?? "?"} ` +
          `doc=${report["document-uri"] ?? "?"} line=${report["line-number"] ?? "?"} ` +
          `src=${report["source-file"] ?? "?"}`,
      );
    }
  } catch {
    // Never fail the reporter.
  }
  return new NextResponse(null, { status: 204 });
}
