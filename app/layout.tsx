import type { Metadata, Viewport } from "next";
import { Playfair_Display, Sora } from "next/font/google";
import "./globals.css";
// Serene Neumorphic token layer — must load AFTER the base globals so its
// :root / [data-neu] variables win. Daypart flip: hooks/useDaypartTheme.ts.
import "./indulge-neumorphic-tokens.css";

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

export const metadata: Metadata = {
  title: "Indulge Global — Live Operations Dashboard",
  description: "Real-time performance dashboard for Indulge Global",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050507",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${sora.variable}`}
    >
      <body
        className="bg-neu-canvas text-neu-t1 overflow-hidden antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
