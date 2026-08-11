"use client";

/**
 * /settings — the non-technical admin surface for the dashboard.
 *
 * Three tabs:
 *   Agents       → the concierge roster per queendom (was lib/agentRoster.ts)
 *   Renewals     → rows in `renewals`, feeding "Renewals This Month"
 *   New Clients  → rows in `members`, feeding "Latest Assignments"
 *
 * Locked behind a shared PIN (SETTINGS_PIN). The gate is a convenience for the
 * UI only — every /api/settings/* route independently verifies the session
 * cookie, so hiding the tabs is never the thing keeping anyone out.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AgentsTab } from "@/components/settings/AgentsTab";
import { ClientRowsTab, type ClientRowsTabConfig } from "@/components/settings/ClientRowsTab";
import { settingsRequest } from "@/components/settings/api";
import { Button, Field, Notice } from "@/components/settings/ui";

type TabId = "agents" | "renewals" | "clients";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "renewals", label: "Renewals" },
  { id: "clients", label: "New Clients" },
];

const RENEWALS_CONFIG: ClientRowsTabConfig = {
  endpoint: "renewals",
  addTitle: "Record a renewal",
  addDescription:
    "Adds to the Renewals This Month count and the latest-renewals list on that queendom's panel.",
  listTitle: "Recent renewals",
  listDescription: "Newest first. The TV counts only entries dated in the current month.",
  dateLabel: "Renewal date",
  nameLabel: "Client name",
  namePlaceholder: "e.g. Ravi Kailas",
  entityLabel: "Renewal",
};

const CLIENTS_CONFIG: ClientRowsTabConfig = {
  endpoint: "members",
  addTitle: "Add a new client",
  addDescription:
    "Adds to the Latest Assignments list on that queendom's panel. Membership records themselves (plan, amount, expiry) still come from the main client system — this is the assignment only.",
  listTitle: "Recent assignments",
  listDescription: "Newest first. The TV shows only entries dated in the current month.",
  dateLabel: "Assigned on",
  nameLabel: "Client name",
  namePlaceholder: "e.g. Richa Raj",
  entityLabel: "Assignment",
};

export default function SettingsPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("agents");

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
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-3xl text-champagne">Settings</h1>
          <p className="mt-1 font-montserrat text-[13px] text-charcoal-300">
            Changes appear on the TV within a few seconds — no redeploy needed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-montserrat text-[13px] text-gold-300 underline-offset-4 hover:underline"
          >
            View dashboard
          </Link>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-md px-4 py-2 font-montserrat text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-gold-400 text-obsidian"
                : "border border-[var(--border-gold-dim)] text-charcoal-200 hover:border-[var(--border-gold-mid)] hover:text-champagne"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "agents" ? <AgentsTab onUnauthorized={lock} /> : null}
      {tab === "renewals" ? (
        <ClientRowsTab config={RENEWALS_CONFIG} onUnauthorized={lock} />
      ) : null}
      {tab === "clients" ? (
        <ClientRowsTab config={CLIENTS_CONFIG} onUnauthorized={lock} />
      ) : null}
    </main>
  );
}

// ─── PIN gate ─────────────────────────────────────────────────────────────────

function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = useCallback(async () => {
    if (!pin.trim()) return;
    setChecking(true);
    const res = await settingsRequest<{ unlocked: boolean }>("/api/settings/session", {
      method: "POST",
      body: { pin },
    });
    setChecking(false);
    if (res.ok && res.data?.unlocked) {
      setPin("");
      onUnlocked();
      return;
    }
    setError(res.error ?? "Incorrect PIN");
  }, [pin, onUnlocked]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="w-full max-w-sm rounded-xl border border-[var(--border-gold-dim)] bg-surface-card p-7"
      >
        <h1 className="font-cinzel text-2xl text-champagne">Settings</h1>
        <p className="mb-6 mt-1 font-montserrat text-[13px] text-charcoal-300">
          Enter the team PIN to manage agents, renewals, and new clients.
        </p>

        <Field label="PIN">
          <input
            type="password"
            value={pin}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => {
              setPin(e.target.value);
              setError(null);
            }}
            className="w-full rounded-md border border-[var(--border-gold-subtle)] bg-black/40 px-3 py-2 font-montserrat text-sm tracking-[0.3em] text-champagne focus:border-[var(--border-gold-bright)] focus:outline-none"
          />
        </Field>

        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <div className="mt-6">
          <Button type="submit" disabled={checking || !pin.trim()}>
            {checking ? "Checking…" : "Unlock"}
          </Button>
        </div>
      </form>
    </main>
  );
}
