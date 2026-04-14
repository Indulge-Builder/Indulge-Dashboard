"use client";

/**
 * components/ui/ErrorBoundary.tsx
 *
 * React class-based error boundary for wrapping individual dashboard widgets.
 *
 * Design goal: when a widget crashes, the fallback must look like an intentional
 * "service offline" state — not a broken web page. The TV must stay premium even
 * in failure mode.
 *
 * Fallback UI design tokens (from globals.css Step 1):
 *   --bg-obsidian     #050507              — outer wrapper background
 *   --border-gold-dim rgba(212,175,55,0.08) — near-invisible gold border
 *   --gold-primary    #d4af37              → text-gold-400/50  (muted heading)
 *   --color-champagne #f5e6c8              → text-champagne/35 (body copy)
 *   --radius-card     1rem                 → rounded-card
 *
 * The fallback is intentionally quiet:
 *   ◈  [WIDGET]  OFFLINE  ◈   ← gold diamond delimiters (unicode U+25C8)
 *   "This widget is temporarily unavailable."
 *   [ ↺ RETRY ] button         ← resets boundary state to attempt re-render
 *
 * Usage:
 *   // Basic — uses generic "SERVICE" label
 *   <ErrorBoundary>
 *     <AgentLeaderboard … />
 *   </ErrorBoundary>
 *
 *   // Named — shows "LEADERBOARD OFFLINE" in the fallback
 *   <ErrorBoundary label="Leaderboard">
 *     <AgentLeaderboard … />
 *   </ErrorBoundary>
 *
 *   // Custom fallback — override everything
 *   <ErrorBoundary fallback={<MyCustomError />}>
 *     <ActiveOutlays … />
 *   </ErrorBoundary>
 *
 *   // Full-height — fills its flex parent (for panels that must maintain layout)
 *   <ErrorBoundary label="Finances" fillParent>
 *     <ActiveOutlays … />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode, type ErrorInfo } from "react";

// ── Props & State ─────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children:     ReactNode;
  /**
   * Widget display name shown in the fallback heading.
   * Rendered as: "◈  {LABEL}  OFFLINE  ◈"
   * @default "SERVICE"
   */
  label?:       string;
  /**
   * Fully custom fallback UI — overrides the default offline panel when provided.
   */
  fallback?:    ReactNode;
  /**
   * When true the outer wrapper uses `flex-1 h-full` so it fills its flex
   * parent without collapsing the layout.
   * @default false
   */
  fillParent?:  boolean;
}

interface ErrorBoundaryState {
  hasError:  boolean;
  errorMsg:  string;
}

// ── Default offline fallback panel ───────────────────────────────────────────
//
// Deliberately muted — no red, no stack traces, no browser-default error prose.
// Looks identical to a deliberately disabled/maintenance widget on the TV wall.

function OfflineFallback({
  label,
  onRetry,
  fillParent,
}: {
  label:      string;
  onRetry:    () => void;
  fillParent: boolean;
}) {
  return (
    <div
      className={[
        // Outer: obsidian background, near-invisible gold border, card radius
        "relative flex flex-col items-center justify-center text-center",
        "bg-[#050507] border border-gold-500/[0.08] rounded-card",
        "px-[clamp(16px,3vw,40px)] py-[clamp(24px,4vh,56px)]",
        fillParent ? "flex-1 h-full w-full" : "w-full",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Ultra-subtle ambient radial — same token as ambient-glow-center */}
      <div
        className="pointer-events-none absolute inset-0 rounded-card"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,168,76,0.025), transparent)",
        }}
        aria-hidden
      />

      {/* Diamond delimiters + label (U+25C8 WHITE DIAMOND CONTAINING BLACK SMALL DIAMOND) */}
      <p
        className="relative font-cinzel font-bold uppercase tracking-[0.4em] leading-none text-gold-400/50"
        style={{ fontSize: "var(--text-label-lg)" }}
        aria-label={`${label} offline`}
      >
        ◈&nbsp;&nbsp;{label}&nbsp;&nbsp;OFFLINE&nbsp;&nbsp;◈
      </p>

      {/* Separator — .separator-gold-h utility from Step 1 */}
      <div
        className="separator-gold-h w-[clamp(80px,30%,200px)] my-[clamp(12px,2vh,24px)]"
        aria-hidden
      />

      {/* Body copy */}
      <p
        className="font-inter font-medium leading-relaxed text-champagne/35 max-w-[28ch]"
        style={{ fontSize: "var(--text-label-md)" }}
      >
        This widget is temporarily unavailable.
        <br />
        The dashboard will retry automatically.
      </p>

      {/* Retry button — quiet gold outline, no fill */}
      <button
        type="button"
        onClick={onRetry}
        className={[
          "relative mt-[clamp(16px,2.5vh,32px)]",
          "font-inter font-semibold uppercase tracking-[0.32em]",
          "text-gold-400/60 hover:text-gold-300/80",
          "border border-gold-500/[0.15] hover:border-gold-500/[0.28]",
          "rounded-[var(--radius-pill)]",
          "px-[clamp(16px,2.5vw,28px)] py-[clamp(8px,1.2vh,14px)]",
          "transition-colors duration-300",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold-500/40",
        ].join(" ")}
        style={{ fontSize: "var(--text-label-md)" }}
        aria-label={`Retry ${label}`}
      >
        ↺&nbsp;&nbsp;RETRY
      </button>
    </div>
  );
}

// ── ErrorBoundary ─────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    return { hasError: true, errorMsg };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console for developer visibility without exposing to the TV screen
    console.error(
      `[ErrorBoundary] Widget "${this.props.label ?? "SERVICE"}" crashed:`,
      error,
      info.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMsg: "" });
  };

  render() {
    const { children, fallback, label = "SERVICE", fillParent = false } =
      this.props;

    if (!this.state.hasError) {
      return children;
    }

    // Caller-provided custom fallback takes full priority
    if (fallback != null) {
      return fallback;
    }

    // Default premium offline panel
    return (
      <OfflineFallback
        label={label.toUpperCase()}
        onRetry={this.handleRetry}
        fillParent={fillParent}
      />
    );
  }
}
