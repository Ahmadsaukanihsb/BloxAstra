import type { SVGProps } from "react";

/**
 * Hand-tuned SVG icon set: 24px grid, 1.6 stroke, round caps.
 * Kept local so every glyph shares one optical weight and server components
 * never need a client boundary for decorative icons.
 */
interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHexCoin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.8 20.4 7.4v9.2L12 21.2 3.6 16.6V7.4z" />
    <path d="M9.2 9.4h5.6M12 9.4v6.2M9.8 15.6h4.4" />
  </Svg>
);

export const IconPackage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 20.4 7.5v9L12 21l-8.4-4.5v-9z" />
    <path d="M3.6 7.5 12 12l8.4-4.5M12 12v9" />
  </Svg>
);

export const IconGift = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.2" y="8.6" width="17.6" height="12.2" rx="2.2" />
    <path d="M3.2 12.6h17.6M12 8.6v12.2" />
    <path d="M12 8.6S10.6 3 8.1 3.2a2.4 2.4 0 0 0 .3 5.4M12 8.6s1.4-5.6 3.9-5.4a2.4 2.4 0 0 1-.3 5.4" />
  </Svg>
);

export const IconUserSquare = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.4" />
    <circle cx="12" cy="10.2" r="2.6" />
    <path d="M7.2 18.4c1.2-2.1 2.9-3.2 4.8-3.2s3.6 1.1 4.8 3.2" />
  </Svg>
);

export const IconCrown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.2 8.4 6.6 11.6 12 4.8l5.4 6.8 3.4-3.2-2 9.6H5.2z" />
    <path d="M5.2 19.4h13.6" />
  </Svg>
);

export const IconShieldCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5.2 5.8v5.5c0 4.3 2.8 7.8 6.8 9.7 4-1.9 6.8-5.4 6.8-9.7V5.8z" />
    <path d="M9.1 12.1l2.2 2.2 3.6-4" />
  </Svg>
);

export const IconSealCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.8l2.3 1.6 2.8-.3 1.1 2.6 2.5 1.3-.7 2.7.7 2.7-2.5 1.3-1.1 2.6-2.8-.3L12 21.2l-2.3-1.6-2.8.3-1.1-2.6-2.5-1.3.7-2.7-.7-2.7 2.5-1.3 1.1-2.6 2.8.3z" />
    <path d="M9.2 11.9l2 2 3.8-4.1" />
  </Svg>
);

export const IconBolt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.6 2.6 5.4 13.4h5.1L9.6 21.4l8.2-10.8h-5.1z" />
  </Svg>
);

export const IconStar = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.8l5.9-.8z" />
  </Svg>
);

export const IconHeart = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20.4S3.8 15.4 3.8 9.6A4.6 4.6 0 0 1 8.4 5c1.7 0 2.9.9 3.6 2.1A4.6 4.6 0 0 1 15.6 5a4.6 4.6 0 0 1 4.6 4.6c0 5.8-8.2 10.8-8.2 10.8z" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="M15.8 15.8 20.5 20.5" />
  </Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7.5h9M18.5 7.5h1.5M4 16.5h4.5M14 16.5h6" />
    <circle cx="15.5" cy="7.5" r="2.2" />
    <circle cx="11" cy="16.5" r="2.2" />
  </Svg>
);

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" />
  </Svg>
);

export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8.5 7H17v8.5" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.1}>
    <path d="M4.8 12.6 9.4 17.2 19.2 6.8" />
  </Svg>
);

export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M8.2 12.3l2.7 2.7 4.9-5.4" />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.4 2.1" />
  </Svg>
);

export const IconTimer = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="13.4" r="7.4" />
    <path d="M12 9.8v3.6l2.6 1.6M9.4 2.6h5.2M17.4 6.2l1.5-1.5" />
  </Svg>
);

export const IconAt = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
  </Svg>
);

export const IconReply = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6 4.6 10.4a1.2 1.2 0 0 0 0 1.8L9.5 16.6" />
    <path d="M4.8 11.3h8.4a5.6 5.6 0 0 1 5.6 5.6v1.3" />
  </Svg>
);

export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15.6 4.6a2 2 0 0 1 2.9 2.9L8.4 17.6l-3.9 1 1-3.9z" />
    <path d="M14.2 6 18 9.8" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.6 6.9h14.8M9.6 6.9V5.1a1.2 1.2 0 0 1 1.2-1.2h2.4a1.2 1.2 0 0 1 1.2 1.2v1.8" />
    <path d="M6.5 6.9l.8 11.3a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-11.3" />
    <path d="M10.2 10.4v6M13.8 10.4v6" />
  </Svg>
);

export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21V4" />
    <path d="M6 4.8h11.4l-1.9 4 1.9 4H6z" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.2 12.4c0 3.9-3.7 7-8.2 7-1 0-1.9-.1-2.7-.4L4.6 20.6l1.3-3.4a6.6 6.6 0 0 1-2.3-4.8c0-3.9 3.7-7 8.2-7s8.4 3.1 8.4 7z" />
  </Svg>
);

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.6a6 6 0 0 1 12 0c0 4 1.4 5.4 2.2 6.2H3.8C4.6 15 6 13.6 6 9.6" />
    <path d="M10 19.4a2.2 2.2 0 0 0 4 0" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.4" y="10" width="15.2" height="10.6" rx="2.8" />
    <path d="M8 10V7.6a4 4 0 0 1 8 0V10" />
  </Svg>
);

export const IconWallet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="3.2" />
    <path d="M3 10.4h18" />
    <circle cx="16.6" cy="14.8" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconTrendUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 16.6 9.6 11l3.5 3.5L20 7.4" />
    <path d="M14.8 7.4H20v5.2" />
  </Svg>
);

export const IconStorefront = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.6 9.8V19a1.2 1.2 0 0 0 1.2 1.2h12.4A1.2 1.2 0 0 0 19.4 19V9.8" />
    <path d="M3 9.8 5 4h14l2 5.8z" />
    <path d="M9.8 20.2v-5.4h4.4v5.4" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.2" cy="9" r="3.1" />
    <path d="M3.4 19.4c.9-2.8 3.1-4.2 5.8-4.2s4.9 1.4 5.8 4.2" />
    <path d="M16.2 6.3a3.1 3.1 0 0 1 0 5.6M17.6 19.1a6.7 6.7 0 0 0-1.2-3" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.7 4.3 2.9 17.3a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.3 4.3a1.6 1.6 0 0 0-2.6 0z" />
    <path d="M12 9.4v4.2M12 17h.01" />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11.2v5.4M12 7.7h.01" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11.4" height="11.4" rx="2.6" />
    <path d="M15.2 5.6A2.6 2.6 0 0 0 12.6 3H6.6A2.6 2.6 0 0 0 4 5.6v6a2.6 2.6 0 0 0 2.6 2.6" />
  </Svg>
);

export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.4l1.8 5.4 5.4 1.8-5.4 1.8-1.8 5.4-1.8-5.4L4.8 10.6l5.4-1.8z" />
    <path d="M18.8 16.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.2 9.6 12 15.4l5.8-5.8" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.6 6.2 15.4 12l-5.8 5.8" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.4v13.2M5.4 12h13.2" />
  </Svg>
);

export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.4 12h13.2" />
  </Svg>
);

export const IconQrCode = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.4" y="3.4" width="7" height="7" rx="1.8" />
    <rect x="13.6" y="3.4" width="7" height="7" rx="1.8" />
    <rect x="3.4" y="13.6" width="7" height="7" rx="1.8" />
    <path d="M13.6 13.6h3v3h-3zM20.6 13.6v.01M13.6 20.6h.01M20.6 20.6v.01M17.1 20.6h.01M20.6 17.1h.01" />
  </Svg>
);

export const IconBank = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.4 9.6 12 4l8.6 5.6" />
    <path d="M5.6 10.2v7.6M10 10.2v7.6M14 10.2v7.6M18.4 10.2v7.6" />
    <path d="M3.2 20.4h17.6" />
  </Svg>
);

export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.6" y="2.6" width="10.8" height="18.8" rx="3" />
    <path d="M11 18.4h2" />
  </Svg>
);

export const IconFingerprint = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.6C7.3 3.6 3.5 7.4 3.5 12.1v3" />
    <path d="M12 7.6a4.4 4.4 0 0 0-4.4 4.4v5.4" />
    <path d="M12 11.6a1 1 0 0 0-1 1v7.4" />
    <path d="M12 11.6a1 1 0 0 1 1 1V20" />
    <path d="M16.4 12a4.4 4.4 0 0 0-1.2-3.1" />
    <path d="M20.5 12.1v3" />
  </Svg>
);

export const IconScanFace = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.6V6.6A2.6 2.6 0 0 1 6.6 4h2M15.4 4h2A2.6 2.6 0 0 1 20 6.6v2M20 15.4v2A2.6 2.6 0 0 1 17.4 20h-2M8.6 20h-2A2.6 2.6 0 0 1 4 17.4v-2" />
    <path d="M9.2 10.4v1.6M14.8 10.4v1.6M9.6 15.2c1.4 1 3.4 1 4.8 0" />
  </Svg>
);

export const IconFileText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.2 3.6h7.2L19 9.2v11a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 20.2V4.8a1.2 1.2 0 0 1 1.2-1.2z" />
    <path d="M13.2 3.6v5.6H19" />
    <path d="M8.6 13.6h6.8M8.6 17h4.4" />
  </Svg>
);

export const IconScale = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.2v15.6M7.6 19.8h8.8" />
    <path d="M4.6 8h14.8" />
    <path d="M4.6 8 2.4 14h4.4zM19.4 8l-2.2 6h4.4z" />
  </Svg>
);

export const IconFlame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.4c.8 2.4 1.6 4.2 1.6 6.2 1-.4 1.7-1.1 2.2-2.1 1 1.2 1.8 2.7 1.8 4.3a5.6 5.6 0 0 1-11.2 0c0-2.6 1.4-5 3.2-6.6.3 1 .8 1.7 1.6 2.1.2-1.4.5-2.6.8-3.9z" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M4 7.6h16M4 12h16M4 16.4h16" />
  </Svg>
);

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.6 12 4l8 6.6V19a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 19z" />
    <path d="M9.6 20.2v-5.6h4.8v5.6" />
  </Svg>
);

export const IconReceipt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.6h12v16.8l-2.6-1.6-2.4 1.6-2.4-1.6-2.6 1.6z" />
    <path d="M9.4 8.4h5.2M9.4 12.4h5.2" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.6 12S6 6.6 12 6.6 21.4 12 21.4 12 18 17.4 12 17.4 2.6 12 2.6 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.2 4.2 19.8 19.8" />
    <path d="M9.6 5.9A9.3 9.3 0 0 1 12 5.6c6 0 9.4 5.4 9.4 5.4a17.4 17.4 0 0 1-3.1 3.9M6.5 8A17.6 17.6 0 0 0 2.6 11s3.4 5.4 9.4 5.4c1 0 1.9-.2 2.7-.5" />
    <path d="M9.7 9.8a2.9 2.9 0 0 0 3.9 3.9" />
  </Svg>
);

export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.5-5.8" />
    <path d="M20 4.2v4.4h-4.4" />
  </Svg>
);

export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M3.4 12h17.2" />
    <path d="M12 3.4c2.3 2.4 3.5 5.3 3.5 8.6S14.3 18.2 12 20.6c-2.3-2.4-3.5-5.3-3.5-8.6S9.7 5.8 12 3.4z" />
  </Svg>
);

export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.6" y="3.6" width="7" height="7" rx="2" />
    <rect x="13.4" y="3.6" width="7" height="7" rx="2" />
    <rect x="3.6" y="13.4" width="7" height="7" rx="2" />
    <rect x="13.4" y="13.4" width="7" height="7" rx="2" />
  </Svg>
);

export const IconChartBars = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20.2h16" />
    <path d="M6.5 20V13M11.5 20V5.5M16.5 20v-9.5" strokeWidth={2} />
  </Svg>
);

export const IconRows = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.6h16M4 12h16M4 17.4h16" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v10M8 10.6l4 4 4-4" />
    <path d="M5 19.6h14" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.2 17.6a4.2 4.2 0 0 1-.4-8.4A5.6 5.6 0 0 1 17.6 10a4.2 4.2 0 0 1 .1 7.6" />
    <path d="M12 20.4v-7.6M9.2 15.4l2.8-2.8 2.8 2.8" />
  </Svg>
);

export const IconCompass = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M15.4 8.6l-2.1 4.7-4.7 2.1 2.1-4.7z" />
  </Svg>
);

export const IconHeadset = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.6 15.4v-3a7.4 7.4 0 0 1 14.8 0v3" />
    <rect x="2.8" y="13.6" width="4.2" height="6" rx="2" />
    <rect x="17" y="13.6" width="4.2" height="6" rx="2" />
    <path d="M19.4 19.6v.6a2.4 2.4 0 0 1-2.4 2.4h-2.6" />
  </Svg>
);

export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.6 4.4h3.4a1.6 1.6 0 0 1 1.6 1.6v12a1.6 1.6 0 0 1-1.6 1.6h-3.4" />
    <path d="M10 8.4 6 12l4 3.6M6 12h9" />
  </Svg>
);

/* ------------------------------------------------------------------ */
/* Social / brand logos                                                 */
/* ------------------------------------------------------------------ */

export function IconGoogle({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09A6.97 6.97 0 0 1 5.47 12c0-.72.13-1.43.37-2.09V7.07H2.18A11.97 11.97 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function IconDiscord({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.36-.76-.54-1.09-.01-.02-.04-.04-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.03.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.02.03.05.03.07.02 1.72-.53 3.45-1.33 5.24-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z"
        fill="#5865F2"
      />
    </svg>
  );
}

export function IconInstagram({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"
        fill="#FF0069"
      />
    </svg>
  );
}

export function IconTiktok({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
        fill="#000000"
      />
    </svg>
  );
}

export function IconYoutube({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
        fill="#FF0000"
      />
    </svg>
  );
}

export function IconFacebook({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
        fill="#0866FF"
      />
    </svg>
  );
}

export function IconWhatsapp({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
        fill="#25D366"
      />
    </svg>
  );
}

export function IconXTwitter({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"
        fill="#000000"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Brand marks                                                         */
/* ------------------------------------------------------------------ */

export function AstraMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 2.4 29.6 9.2v13.6L16 29.6 2.4 22.8V9.2z" fill="currentColor" opacity="0.14" />
      <path
        d="M16 2.4 29.6 9.2v13.6L16 29.6 2.4 22.8V9.2z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.42"
      />
      <path
        d="M16 7.6l2.1 5.5 5.5.4-4.2 3.4 1.4 5.6-4.8-3.2-4.8 3.2 1.4-5.6-4.2-3.4 5.5-.4z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RobuxGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.4 7.2 12 2.4l8.6 4.8v9.6L12 21.6l-8.6-4.8z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M3.4 7.2 12 2.4l8.6 4.8v9.6L12 21.6l-8.6-4.8z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M9.6 8.6h4.9a2.3 2.3 0 0 1 0 4.6H9.6m0 0h4.6l3 3.4m-7.6-3.4v3.4m0-8.6v8.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
