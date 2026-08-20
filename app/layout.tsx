import type { Metadata, Viewport } from "next";
import {
  Playfair_Display,
  Sora,
  Hanken_Grotesk,
  IBM_Plex_Mono,
  Cormorant_Garamond,
} from "next/font/google";
import "./globals.css";

// Two-font system (data face swapped Montserrat → Sora, 2026-06-24):
//   Cinzel → all titles / labels / headings
//   Sora   → all data / numbers / body
// Inter, Libre Baskerville, and "Edu …" were retired — do not re-add a third
// display face without updating tailwind.config fontFamily + this comment.
// NB: the data face is Sora but the CSS var stays --font-montserrat and the
// Tailwind utility stays `font-montserrat` (legacy names kept so the direct
// var(--font-montserrat) refs in charts/onboarding keep resolving).
// FONT TRIAL (title slot): Playfair Display — keeps --font-cinzel var name so
// every font-cinzel / var(--font-cinzel) ref resolves to the trial face.
const cinzel = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// ── Mobile "app trinity" (dark-example design system) — used ONLY under
// .mroot, so the TV never references (or downloads) these faces:
// Hanken = UI + debossed numerals · Plex Mono = tracked-caps kickers ·
// Cormorant = voice moments (titles, queendom names).
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plexmono",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Indulge Global — Live Operations Dashboard",
  description: "Real-time performance dashboard for Indulge Global",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050507",
  // Mobile shell paints into the notch/home-bar areas via env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${sora.variable} ${hanken.variable} ${plexMono.variable} ${cormorant.variable}`}
    >
      <body
        className="bg-obsidian text-champagne overflow-hidden antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
