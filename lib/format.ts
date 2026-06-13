/**
 * lib/format.ts — tiny display-format helpers shared across components
 * (dry-audit A4/A5 — previously duplicated per component file).
 */

/** "Sakshi Bhutkar" → "SB"; single names take the first two letters. */
export function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

/** Sanitize: null/undefined/NaN → 0 to prevent UI flicker on TV. */
export function safeNum(v: number | null | undefined): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}
