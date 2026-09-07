/**
 * lib/tvScale.ts — design-handoff px → fluid CSS lengths.
 *
 * The concierge handoff (design_handoff_three_queendoms, 2026-09-04) is
 * authored at the TV's real stage: 6144 × 3456 CSS px, where every clamp()
 * token sits at its max. These helpers express a handoff value as
 * `clamp(min, fluid, value)` so the TV renders the exact pixel while smaller
 * viewports scale proportionally (cqw/cqh resolve to the viewport here — no
 * ancestor declares container-type, matching the rest of the TV tree).
 *
 * Use for NEW spacing/sizes only. Existing tokens (`--pad-card`,
 * `.label-field`, the leaderboard clamps …) already land on the handoff's
 * numbers at the stage — keep using those.
 */

export const STAGE_WIDTH_PX = 6144;
export const STAGE_HEIGHT_PX = 3456;

/** Default floor: a 1920-wide dev viewport renders at 0.3125 × stage. */
const MIN_RATIO = 0.3;

/** Width-relative length that equals `px` on the TV stage. */
export function fw(px: number, minRatio = MIN_RATIO): string {
  const vw = (px / STAGE_WIDTH_PX) * 100;
  return `clamp(${round(px * minRatio)}px, ${round(vw, 3)}cqw, ${px}px)`;
}

/** Height-relative length that equals `px` on the TV stage. */
export function fh(px: number, minRatio = MIN_RATIO): string {
  const vh = (px / STAGE_HEIGHT_PX) * 100;
  return `clamp(${round(px * minRatio)}px, ${round(vh, 3)}cqh, ${px}px)`;
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
