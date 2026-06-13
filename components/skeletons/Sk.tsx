import type { CSSProperties } from "react";

/** Shimmer placeholder block — shared by all skeleton screens (dry-audit A3). */
export function Sk({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton-block ${className}`} style={style} aria-hidden />;
}
