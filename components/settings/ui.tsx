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
import { QUEENDOM_DISPLAY_NAME } from "@/lib/queendom";

// ─── Buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-400 text-obsidian hover:bg-gold-300 disabled:bg-gold-800 disabled:text-charcoal-300",
  ghost:
    "border border-[var(--border-gold-mid)] text-champagne hover:border-[var(--border-gold-bright)] hover:bg-white/5",
  danger:
    "border border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/70",
};

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md px-4 py-2 font-montserrat text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_STYLES[variant]}`}
    >
      {children}
    </button>
  );
}

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

export const QUEENDOM_OPTIONS: readonly { value: QueendomId; label: string }[] = [
  { value: "ananyshree", label: QUEENDOM_DISPLAY_NAME.ananyshree },
  { value: "anishqa", label: QUEENDOM_DISPLAY_NAME.anishqa },
];

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
  const isAnanyshree = queendom === "ananyshree";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-montserrat text-[11px] ${
        isAnanyshree
          ? "border-gold-400/40 text-gold-300"
          : "border-sky-400/40 text-sky-300"
      }`}
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
