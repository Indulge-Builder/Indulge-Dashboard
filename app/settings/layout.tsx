import type { Metadata } from "next";

/**
 * The root layout locks `body` to `overflow-hidden` because the dashboard is a
 * fullscreen, no-scroll TV surface. Settings is the opposite — a normal admin
 * page used on a laptop — so it owns its own scroll container instead of
 * unsetting the body rule and risking a scrollbar on the TV.
 */

export const metadata: Metadata = {
  title: "Settings — Indulge Dashboard",
  description: "Manage the concierge roster, renewals, and new client assignments",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-y-auto bg-obsidian text-champagne">
      {children}
    </div>
  );
}
