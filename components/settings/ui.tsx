"use client";

/**
 * components/settings/ui.tsx
 *
 * Small shared primitives for the Settings page. Deliberately plain and
 * high-contrast: this page is used on a laptop by non-technical staff, not on
 * the 4K TV, so it favours legibility and obvious affordances over the
 * dashboard's cinematic styling. It still borrows the brand tokens (obsidian /
 * gold / champagne, Playfair titles, Sora body) so it doesn't feel bolted on.
 */

import type { ReactNode } from "react";
import type { QueendomId } from "@/types";
import { QUEENDOM_DISPLAY_NAME, QUEENDOM_IDS } from "@/lib/queendom";

// ─── Buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "ghost" | "danger" | "subtle";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-400 text-obsidian hover:bg-gold-300 disabled:bg-gold-800 disabled:text-charcoal-300",
  ghost:
    "border border-[var(--border-gold-mid)] text-champagne hover:border-[var(--border-gold-bright)] hover:bg-white/5",
  danger:
    "border border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/70",
  /** Text-only row action — quiet until hovered, so a row of five doesn't shout. */
  subtle:
    "text-charcoal-200 hover:bg-white/[0.06] hover:text-champagne",
};

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  title,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  disabled?: boolean;
  title?: string;
  size?: "md" | "sm";
}) {
  const pad = size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-4 py-2 text-sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md font-montserrat font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${pad} ${BUTTON_STYLES[variant]}`}
    >
      {children}
    </button>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Segmented control for switching queendoms / sections. Selection is a static
 * class swap (no tweened colour); `accent` lets the queendom switcher carry
 * each queendom's chip colour.
 */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; hint?: string; accentClass?: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--border-gold-dim)] bg-black/30 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex items-baseline gap-2 rounded-md px-3.5 py-2 font-montserrat text-sm font-semibold transition-[background-color,color] duration-150 ${
              active
                ? "bg-gold-400/15 text-champagne shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]"
                : "text-charcoal-200 hover:bg-white/[0.05] hover:text-champagne"
            }`}
          >
            {o.accentClass ? (
              <span className={`inline-block h-2 w-2 rounded-full ${o.accentClass}`} aria-hidden />
            ) : null}
            {o.label}
            {o.hint ? (
              <span className="font-normal text-[11px] text-charcoal-300">{o.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Solid dot colour per queendom (pairs with QUEENDOM_CHIP_CLASS). */
export const QUEENDOM_DOT_CLASS: Record<QueendomId, string> = {
  ananyshree: "bg-gold-400",
  anishqa: "bg-sky-400",
  sanika: "bg-emerald-400",
};

// ─── Form fields ──────────────────────────────────────────────────────────────

const FIELD_CLASS =
  "w-full rounded-md border border-[var(--border-gold-subtle)] bg-black/40 px-3 py-2 " +
  "font-montserrat text-sm text-champagne placeholder:text-charcoal-300 " +
  "focus:border-[var(--border-gold-bright)] focus:outline-none";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-montserrat text-[11px] uppercase tracking-[0.14em] text-gold-400/80">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="font-montserrat text-[11px] text-charcoal-300">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={FIELD_CLASS}
    />
  );
}

export function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD_CLASS} [color-scheme:dark]`}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={FIELD_CLASS}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-obsidian">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const QUEENDOM_OPTIONS: readonly { value: QueendomId; label: string }[] =
  QUEENDOM_IDS.map((value) => ({ value, label: QUEENDOM_DISPLAY_NAME[value] }));

/** Chip colour per queendom — one accent each so rows scan at a glance. */
const QUEENDOM_CHIP_CLASS: Record<QueendomId, string> = {
  ananyshree: "border-gold-400/40 text-gold-300",
  anishqa: "border-sky-400/40 text-sky-300",
  sanika: "border-emerald-400/40 text-emerald-300",
};

// ─── Layout / feedback ────────────────────────────────────────────────────────

export function Card({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border-gold-dim)] bg-surface-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-cinzel text-lg text-champagne">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl font-montserrat text-[13px] leading-relaxed text-charcoal-300">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Inline status line. `tone` drives colour only — the text carries the meaning. */
export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const toneClass = {
    error: "border-red-500/40 bg-red-500/10 text-red-200",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    info: "border-[var(--border-gold-subtle)] bg-white/5 text-champagne",
  }[tone];

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 font-montserrat text-[13px] ${toneClass}`}
    >
      {children}
    </p>
  );
}

export function QueendomChip({ queendom }: { queendom: QueendomId | null }) {
  if (!queendom) {
    return (
      <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-montserrat text-[11px] text-charcoal-300">
        Unassigned
      </span>
    );
  }
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-montserrat text-[11px] ${QUEENDOM_CHIP_CLASS[queendom]}`}
    >
      {QUEENDOM_DISPLAY_NAME[queendom]}
    </span>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center font-montserrat text-[13px] text-charcoal-300">
      {children}
    </p>
  );
}
