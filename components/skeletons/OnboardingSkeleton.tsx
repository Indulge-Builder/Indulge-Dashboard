/**
 * components/skeletons/OnboardingSkeleton.tsx
 *
 * Structural mirror of OnboardingPanel — same 3-column CSS grid, same
 * padding, same flex proportions — but every data region replaced with
 * .skeleton-block shimmer placeholders so the layout is pixel-stable when
 * the real panel fades in over the top.
 *
 * Layout mirrors OnboardingPanel exactly:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │               ── Revenue Dashboard ──                    │  header
 *   ├──────────────────┬──────────────────┬───────────────────┤
 *   │  Col 1           │  Col 2           │  Col 3            │
 *   │  Concierge dept  │  Performance +   │  Shop dept        │
 *   │  3 agent cards   │  4 metric tiles  │  3 agent cards    │
 *   │                  │  + line graph    │                   │
 *   │                  ├──────────────────┤                   │
 *   │                  │  Conversion      │                   │
 *   │                  │  Ledger          │                   │
 *   └──────────────────┴──────────────────┴───────────────────┘
 */

import type { CSSProperties } from "react";

function Sk({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton-block ${className}`} style={style} aria-hidden />;
}

/** Single vertical agent card skeleton — mirrors CompactAgentCard */
function SkAgentCard({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-xl"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#0a0f18",
        gap: "clamp(4px,0.6vmin,8px)",
        padding: "clamp(5px,0.7vmin,10px)",
      }}
    >
      {/* Portrait placeholder */}
      <Sk
        className="w-full rounded-lg"
        style={{
          flex: "1 1 0",
          minHeight: "clamp(70px,12vh,160px)",
          animationDelay: `${delay}s`,
        }}
      />
      {/* Name */}
      <Sk
        className="w-3/4 self-center rounded-md"
        style={{ height: "clamp(14px,1.8vmin,22px)", animationDelay: `${delay + 0.07}s` }}
      />
      {/* 3 metric boxes */}
      <div className="grid grid-cols-3" style={{ gap: "clamp(3px,0.5vmin,7px)" }}>
        {[0.14, 0.21, 0.28].map((d, i) => (
          <Sk
            key={i}
            className="rounded-lg"
            style={{ height: "clamp(38px,5.5vmin,68px)", animationDelay: `${delay + d}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Department column skeleton (left or right): heading + 3 stacked agent cards */
function SkDeptColumn({
  accentColor,
  delay = 0,
}: {
  accentColor: string;
  delay?: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="relative flex min-h-0 flex-1 flex-col rounded-2xl"
        style={{
          border: "1px solid rgba(255,255,255,0.14)",
          background: "#0a0f18",
          padding: "clamp(0.45rem,0.9vmin,1rem)",
          gap: "clamp(0.2rem,0.4vmin,0.5rem)",
        }}
      >
        {/* Department heading */}
        <div
          className="flex shrink-0 flex-col"
          style={{
            gap: "clamp(0.35rem,0.7vmin,0.8rem)",
            paddingTop: "clamp(0.4rem,0.9vmin,1rem)",
            marginBottom: "0.4vh",
          }}
        >
          <div className="flex w-full items-center gap-2">
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to right, transparent, ${accentColor}44, ${accentColor}88)`,
              }}
            />
            <Sk
              className="shrink-0 rounded-full"
              style={{
                width: "clamp(60px,8vw,110px)",
                height: "clamp(14px,1.8vmin,22px)",
                animationDelay: `${delay}s`,
              }}
            />
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to left, transparent, ${accentColor}44, ${accentColor}88)`,
              }}
            />
          </div>
          <div className="flex w-full items-center">
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to right, transparent, ${accentColor}33, ${accentColor}55)`,
              }}
            />
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to left, transparent, ${accentColor}33, ${accentColor}55)`,
              }}
            />
          </div>
        </div>

        {/* 3 agent cards — stacked */}
        <div
          className="relative grid min-h-0 w-full flex-1 items-stretch"
          style={{
            gridTemplateColumns: "minmax(0,1fr)",
            gridTemplateRows: "repeat(3, minmax(0,1fr))",
            gap: "clamp(0.3rem,0.55vmin,0.7rem)",
          }}
        >
          {[0, 0.1, 0.2].map((d, i) => (
            <SkAgentCard key={i} delay={delay + d} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Center column: Performance panel (flex-2) + Conversion Ledger (flex-3) */
function SkCenterColumn() {
  return (
    <div
      className="flex min-h-0 flex-col"
      style={{ gap: "clamp(0.55rem,1.2vh,1.25rem)" }}
    >
      {/* ── Performance panel ── */}
      <div
        className="relative flex min-h-0 flex-[2] flex-col overflow-hidden rounded-2xl"
        style={{
          background: "rgba(10,10,10,0.88)",
          border: "1px solid rgba(107,143,255,0.18)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 16px 40px rgba(0,0,0,0.45)",
          padding: "clamp(0.45rem,0.9vmin,1rem)",
          gap: "clamp(0.2rem,0.4vmin,0.5rem)",
        }}
      >
        {/* Heading */}
        <div
          className="flex shrink-0 flex-col"
          style={{
            gap: "clamp(0.35rem,0.7vmin,0.8rem)",
            paddingTop: "clamp(0.4rem,0.9vmin,1rem)",
            marginBottom: "0.4vh",
          }}
        >
          <div className="flex w-full items-center gap-2">
            <div
              className="h-px flex-1"
              style={{
                background: "linear-gradient(to right, transparent, rgba(107,143,255,0.30), rgba(107,143,255,0.55))",
              }}
            />
            <Sk
              className="shrink-0 rounded-full"
              style={{ width: "clamp(80px,10vw,140px)", height: "clamp(14px,1.8vmin,22px)" }}
            />
            <div
              className="h-px flex-1"
              style={{
                background: "linear-gradient(to left, transparent, rgba(255,176,32,0.30), rgba(255,176,32,0.55))",
              }}
            />
          </div>
          <div className="flex w-full items-center">
            <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, rgba(107,143,255,0.28), rgba(107,143,255,0.45))" }} />
            <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, rgba(255,176,32,0.28), rgba(255,176,32,0.45))" }} />
          </div>
        </div>

        {/* 4 metric tiles */}
        <div
          className="grid w-full shrink-0"
          style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "clamp(6px,1vw,14px)" }}
        >
          {[0, 0.07, 0.14, 0.21].map((d, i) => (
            <Sk
              key={i}
              className="rounded-xl"
              style={{
                height: "clamp(56px,9vmin,100px)",
                animationDelay: `${d}s`,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
          ))}
        </div>

        {/* Line graph area */}
        <Sk
          className="min-h-0 flex-1 rounded-xl"
          style={{ animationDelay: "0.18s" }}
        />
      </div>

      {/* ── Conversion Ledger ── */}
      <div
        className="relative flex min-h-0 flex-[3] flex-col overflow-hidden rounded-2xl"
        style={{
          background: "rgba(10,10,10,0.88)",
          border: "1px solid rgba(212,175,55,0.15)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 16px 40px rgba(0,0,0,0.45)",
          padding: "clamp(0.55rem,1.1vmin,1.2rem)",
          gap: "clamp(0.3rem,0.5vmin,0.6rem)",
        }}
      >
        {/* Ledger heading */}
        <div className="flex w-full shrink-0 items-center gap-3" style={{ marginBottom: "0.8vh" }}>
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, rgba(212,175,55,0.35))" }} />
          <Sk
            className="shrink-0 rounded-full"
            style={{ width: "clamp(120px,18vw,220px)", height: "clamp(14px,1.8vmin,22px)" }}
          />
          <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, rgba(212,175,55,0.35))" }} />
        </div>

        {/* Column header row */}
        <div
          className="grid shrink-0 w-full"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: "clamp(4px,0.8vw,12px)",
            paddingBottom: "clamp(6px,0.8vh,10px)",
            borderBottom: "1px solid rgba(212,175,55,0.10)",
          }}
        >
          {[0, 0.06, 0.12, 0.18].map((d, i) => (
            <Sk
              key={i}
              className="rounded-md"
              style={{ height: "clamp(12px,1.6vmin,20px)", animationDelay: `${d}s` }}
            />
          ))}
        </div>

        {/* Ledger rows */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ gap: "clamp(2px,0.3vmin,4px)" }}>
          {[0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42].map((d, i) => (
            <div
              key={i}
              className="grid shrink-0 w-full"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: "clamp(4px,0.8vw,12px)",
                padding: "clamp(5px,0.7vh,9px) 0",
                borderBottom: "1px solid rgba(212,175,55,0.06)",
              }}
            >
              {[0, 0.04, 0.08, 0.12].map((dd, j) => (
                <Sk
                  key={j}
                  className="rounded-md"
                  style={{ height: "clamp(14px,1.8vmin,24px)", animationDelay: `${d + dd}s` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingSkeleton() {
  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-obsidian"
      style={{
        padding:
          "clamp(0.6rem,min(1.6vh,1.8vmin),1.75rem) clamp(0.6rem,min(2.4vmin,3.2vw),2.5rem)",
      }}
    >
      {/* Ambient gold radial glow — matches OnboardingPanel */}
      <div className="ambient-glow-center pointer-events-none absolute inset-0" />

      {/* ── Page header ── */}
      <div className="relative mb-[1.4vh] flex-shrink-0 text-center">
        <div className="mb-[0.7vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
        </div>
        <Sk
          className="mx-auto rounded-full"
          style={{ width: "clamp(160px,20vw,280px)", height: "clamp(24px,3.5vh,44px)" }}
        />
        <div className="mt-[0.8vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/28 to-gold-500/45" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/28 to-gold-500/45" />
        </div>
      </div>

      {/* ── 3-column grid — mirrors OnboardingPanel exactly ── */}
      <div
        className="relative grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: "1fr 1fr 1.05fr",
          gap: "clamp(0.6rem,1.4vw,1.8rem)",
        }}
      >
        {/* Column 1: Concierge (gold accent) */}
        <SkDeptColumn accentColor="rgba(212,175,55,1)" delay={0} />

        {/* Column 2: Performance + Ledger */}
        <SkCenterColumn />

        {/* Column 3: Shop (sky/blue accent) */}
        <SkDeptColumn accentColor="rgba(125,211,252,1)" delay={0.15} />
      </div>
    </section>
  );
}
