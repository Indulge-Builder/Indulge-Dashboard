"use client";

/**
 * Passcode screen shown when the viewer gate is on (lib/viewerGate.ts) and
 * the device has no valid cookie. One field, one button; a correct code sets
 * a 30-day cookie and reloads into the dashboard.
 *
 * Typed once per device, so this screen is rare — it should feel like the
 * brand, not like an error: obsidian ground, the wordmark, a single hairline
 * gold field. Wrong code answers with a message, not a shake.
 */

import { useRef, useState } from "react";

export default function ViewerGate() {
  const [pin, setPin] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || state === "checking") return;
    setState("checking");
    try {
      const res = await fetch("/api/viewer-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch {
      /* treated as wrong below */
    }
    setState("wrong");
    setPin("");
    inputRef.current?.focus();
  }

  return (
    <main className="gate-root">
      <form className="gate-card" onSubmit={submit}>
        <p className="gate-brand">Indulge</p>
        <h1 className="gate-title">Live Dashboard</h1>
        <p className="gate-sub">Enter the passcode to continue</p>

        <input
          ref={inputRef}
          className="gate-input"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-label="Dashboard passcode"
          aria-invalid={state === "wrong"}
          placeholder="••••••"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            if (state === "wrong") setState("idle");
          }}
        />

        <button
          className="gate-button"
          type="submit"
          disabled={state === "checking" || !pin.trim()}
        >
          {state === "checking" ? "Checking…" : "Enter"}
        </button>

        <p className="gate-error" role="alert" aria-live="polite">
          {state === "wrong" ? "That passcode isn't right — try again." : " "}
        </p>
      </form>
    </main>
  );
}
