"use client";

/**
 * components/settings/SettingsShell.tsx
 *
 * The frame every settings screen sits in: the PIN gate (SETTINGS_PIN, signed
 * cookie — lib/settingsAuth.ts), the masthead with breadcrumb + sign-out, and
 * the shared "session expired → re-lock" behaviour. Screens receive `lock` so
 * any 401 from /api/settings/* drops them back to the PIN prompt.
 *
 * The gate is a convenience for the UI only — every /api/settings/* route
 * independently verifies the session cookie.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { settingsRequest } from "./api";
import { Button, Field, Notice } from "./ui";

export interface Crumb {
  label: string;
  href?: string;
}

export function SettingsShell({
  crumbs,
  children,
}: {
  /** Breadcrumb trail after "Settings" — e.g. [Concierge, Sanika]. */
  crumbs?: Crumb[];
  children: (ctx: { lock: () => void }) => ReactNode;
}) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  const checkSession = useCallback(async () => {
    const res = await settingsRequest<{ unlocked: boolean }>("/api/settings/session");
    setUnlocked(res.ok ? Boolean(res.data?.unlocked) : false);
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const lock = useCallback(() => setUnlocked(false), []);

  const signOut = useCallback(async () => {
    await settingsRequest("/api/settings/session", { method: "DELETE" });
    setUnlocked(false);
  }, []);

  if (unlocked === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-montserrat text-sm text-charcoal-300">Loading…</p>
      </main>
    );
  }

  if (!unlocked) {
    return <PinGate onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-gold-dim)] pb-5">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-2 font-montserrat text-[13px]">
            <li>
              <Link
                href="/settings"
                className="font-cinzel text-xl tracking-[0.18em] text-gold-400 gold-glow uppercase"
              >
                Settings
              </Link>
            </li>
            {(crumbs ?? []).map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-2">
                <span className="text-gold-500/50" aria-hidden>
                  ›
                </span>
                {c.href ? (
                  <Link href={c.href} className="text-champagne/80 hover:text-champagne">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-champagne" aria-current="page">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-1 font-montserrat text-[12px] text-charcoal-300">
            Changes reach the TV within seconds — no redeploy needed.
          </p>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-montserrat text-[13px] text-gold-300 underline-offset-4 hover:underline"
          >
            Back to dashboards
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      {children({ lock })}
    </main>
  );
}

// ─── PIN gate ─────────────────────────────────────────────────────────────────

/** The team PIN is four digits; the field submits itself on the fourth. */
const PIN_LENGTH = 4;

function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = useCallback(
    async (candidate: string) => {
      if (candidate.length !== PIN_LENGTH || checking) return;
      setChecking(true);
      const res = await settingsRequest<{ unlocked: boolean }>("/api/settings/session", {
        method: "POST",
        body: { pin: candidate },
      });
      setChecking(false);
      if (res.ok && res.data?.unlocked) {
        setPin("");
        onUnlocked();
        return;
      }
      setPin("");
      setError(res.error ?? "Incorrect PIN");
    },
    [checking, onUnlocked],
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(pin);
        }}
        className="w-full max-w-sm rounded-xl border border-[var(--border-gold-dim)] bg-surface-card p-7 elevate-mid"
      >
        <p className="font-cinzel text-[11px] tracking-[0.4em] text-gold-400/80 uppercase">Indulge</p>
        <h1 className="mt-1 font-cinzel text-2xl text-champagne">Dashboard Settings</h1>
        <p className="mb-6 mt-1 font-montserrat text-[13px] text-charcoal-300">
          Enter the 4-digit team PIN to manage agents, renewals, and new members.
        </p>

        <Field label="PIN">
          <input
            type="password"
            value={pin}
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={PIN_LENGTH}
            placeholder="••••"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
              setPin(digits);
              setError(null);
              if (digits.length === PIN_LENGTH) void submit(digits);
            }}
            className="w-full rounded-md border border-[var(--border-gold-subtle)] bg-black/40 px-3 py-3 text-center font-montserrat text-2xl tracking-[0.9em] text-champagne placeholder:text-champagne/25 focus:border-[var(--border-gold-bright)] focus:outline-none [color-scheme:dark]"
          />
        </Field>

        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link href="/" className="font-montserrat text-[12px] text-charcoal-300 hover:text-champagne">
            ← Back to dashboards
          </Link>
          <Button type="submit" disabled={checking || pin.length !== PIN_LENGTH}>
            {checking ? "Checking…" : "Unlock"}
          </Button>
        </div>
      </form>
    </main>
  );
}
