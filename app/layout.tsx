import type { Metadata, Viewport } from "next";
import { Cinzel, Inter, Libre_Baskerville, Montserrat } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-libre-baskerville",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["600", "700", "800"],
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
      className={`${cinzel.variable} ${inter.variable} ${libreBaskerville.variable} ${montserrat.variable}`}
    >
      <head>
        {/* "Edu AU VIC WA NT Hand Arrows" is not in next/font's catalog, so it
            loads from Google Fonts — preconnected and as a parallel <link>
            instead of the former render-blocking @import in globals.css. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Edu+AU+VIC+WA+NT+Hand+Arrows:wght@400..700&display=swap"
        />
      </head>
      <body
        className="bg-obsidian text-champagne overflow-hidden antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
