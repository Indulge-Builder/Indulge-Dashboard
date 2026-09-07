"use client";

/**
 * /settings — the dashboard's settings home. After the PIN, staff pick which
 * DOMAIN they are administering. Concierge is live (queendoms → agents,
 * renewals, new members); Onboarding is reserved for the revenue screen's
 * future settings and shown disabled so the shape of the panel is clear.
 */

import Link from "next/link";
import { QUEENDOM_DISPLAY_NAME, QUEENDOM_IDS } from "@/lib/queendom";
import { SettingsShell } from "@/components/settings/SettingsShell";

const DOMAINS = [
  {
    id: "concierge",
    href: "/settings/concierge",
    numeral: "I",
    title: "Concierge",
    kicker: "Queendoms · Agents · Renewals · New Members",
    description:
      "The roster shown on each Queendom's leaderboard, plus the renewals and new-member names the TV celebrates this month.",
    contents: QUEENDOM_IDS.map((id) => QUEENDOM_DISPLAY_NAME[id]).join("  ·  "),
    enabled: true,
  },
  {
    id: "onboarding",
    href: "/settings/onboarding",
    numeral: "II",
    title: "Onboarding",
    kicker: "Leads · Deals · Targets",
    description:
      "Sales-floor settings for the revenue screen. Not yet editable here — the Onboarding dashboard still reads its configuration from Zoho and code.",
    contents: "Coming soon",
    enabled: false,
  },
] as const;

export default function SettingsHome() {
  return (
    <SettingsShell>
      {() => (
        <section aria-labelledby="domain-title">
          <h2 id="domain-title" className="font-cinzel text-lg text-champagne">
            Which dashboard do you want to manage?
          </h2>
          <p className="mt-1 font-montserrat text-[13px] text-charcoal-300">
            Each dashboard has its own settings. Pick one to continue.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {DOMAINS.map((d) => {
              const inner = (
                <>
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-500/[0.05] to-transparent" />
                  <div className="relative flex h-full flex-col">
                    <span className="font-cinzel text-[12px] tracking-[0.3em] text-gold-400/60 uppercase">
                      {d.numeral}
                    </span>
                    <h3 className="mt-3 font-cinzel text-3xl font-bold uppercase leading-none tracking-[0.08em] text-gold-400 queen-name-glow">
                      {d.title}
                    </h3>
                    <p className="mt-3 font-cinzel text-[12px] tracking-[0.24em] text-champagne/80 uppercase">
                      {d.kicker}
                    </p>
                    <span className="separator-gold-h my-5 h-px w-full" aria-hidden />
                    <p className="font-montserrat text-[13px] leading-relaxed text-champagne/70">
                      {d.description}
                    </p>
                    <p className="mt-3 font-cinzel text-[11px] tracking-[0.2em] text-gold-400/70 uppercase">
                      {d.contents}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-6">
                      <span className="font-cinzel text-[12px] tracking-[0.28em] text-gold-300 uppercase gold-glow">
                        {d.enabled ? "Open" : "Locked"}
                      </span>
                      {!d.enabled ? (
                        <span className="rounded-full border border-gold-500/25 px-2.5 py-1 font-montserrat text-[11px] uppercase tracking-[0.18em] text-charcoal-300">
                          Coming soon
                        </span>
                      ) : null}
                    </div>
                  </div>
                </>
              );
              const cls =
                "group relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl glass engrave-frame p-7 text-left outline-none";
              return d.enabled ? (
                <Link
                  key={d.id}
                  href={d.href}
                  className={`${cls} elevate-mid transition-transform duration-150 ease-out hover:border-gold-400/45 focus-visible:elevate-hero focus-visible:border-gold-400/45 active:scale-[0.99]`}
                >
                  {inner}
                </Link>
              ) : (
                <div key={d.id} className={`${cls} opacity-60`} aria-disabled>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </SettingsShell>
  );
}
