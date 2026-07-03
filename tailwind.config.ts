import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Existing palette (unchanged — all Tailwind classes still work) ── */
        obsidian: "#050505",
        rosegold: "#C47451",
        gold: {
          50: "#FDF9EF",
          100: "#FAF0D7",
          200: "#F5E0A9",
          300: "#ECC96A",
          400: "#D4AF37",
          500: "#AA7C11",
          600: "#B08B30",
          700: "#8B6914",
          800: "#6B4F0F",
          900: "#4A3509",
        },
        "liquid-gold": {
          start: "#D4AF37",
          end: "#F9E27E",
        },
        champagne: "#F7E7CE",
        charcoal: {
          50: "#F5F4F3",
          100: "#E8E6E3",
          200: "#C8C4BE",
          300: "#A8A299",
          400: "#787069",
          500: "#524D48",
          600: "#3A3530",
          700: "#2C2825",
          800: "#1E1B18",
          900: "#120F0D",
        },
        chocolate: {
          500: "#3D2B1F",
          600: "#2F1F15",
          700: "#20150D",
        },
        olive: {
          400: "#8A9B5C",
          500: "#6B7A45",
          600: "#5C6344",
        },
        /* ── Design system tokens (CSS variable-backed, new) ──────────────── */
        /* Surfaces — use as bg-surface-card, bg-surface-glass, etc.         */
        "surface-card":     "var(--surface-card)",
        "surface-glass":    "var(--surface-glass)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-inset":    "var(--surface-inset)",
        /* Status semantic colors */
        "status-emerald":   "var(--color-emerald)",
        "status-red":       "var(--color-red)",
        "status-amber":     "var(--color-amber)",
        "status-sky":       "var(--color-sky)",
        /* ── Serene Neumorphic tokens (app/indulge-neumorphic-tokens.css) ── */
        "neu-canvas":       "var(--neu-canvas)",
        "neu-surface":      "var(--neu-surface)",
        "neu-surface-high": "var(--neu-surface-high)",
        "neu-well":         "var(--neu-well)",
        "neu-edge":         "var(--neu-edge)",
        "neu-hairline":     "var(--neu-hairline)",
        "neu-accent":       "var(--neu-accent)",
        "neu-accent-deep":  "var(--neu-accent-deep)",
        "neu-accent-fg":    "var(--neu-accent-fg)",
        "neu-sage":         "var(--neu-sage)",
        "neu-sage-deep":    "var(--neu-sage-deep)",
        "neu-powder":       "var(--neu-powder)",
        "neu-powder-deep":  "var(--neu-powder-deep)",
        "neu-butter":       "var(--neu-butter)",
        "neu-butter-deep":  "var(--neu-butter-deep)",
        "neu-lilac":        "var(--neu-lilac)",
        "neu-lilac-deep":   "var(--neu-lilac-deep)",
        "neu-peach":        "var(--neu-peach)",
        "neu-peach-deep":   "var(--neu-peach-deep)",
        "neu-danger":       "var(--neu-danger)",
        "neu-danger-deep":  "var(--neu-danger-deep)",
        "neu-t1":           "var(--neu-text-primary)",
        "neu-t2":           "var(--neu-text-secondary)",
        "neu-t3":           "var(--neu-text-tertiary)",
      },
      fontFamily: {
        // Two-font system: Cinzel (titles/labels), Sora (data/body).
        // `montserrat` key + --font-montserrat var kept as legacy names → Sora.
        cinzel: ["var(--font-cinzel)", "Cinzel", "serif"],
        montserrat: ["var(--font-montserrat)", "Sora", "sans-serif"],
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        "aura-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 12px rgba(212, 175, 55, 0.35), 0 0 24px rgba(212, 175, 55, 0.15)",
          },
          "50%": {
            boxShadow: "0 0 28px rgba(212, 175, 55, 0.55), 0 0 48px rgba(212, 175, 55, 0.25)",
          },
        },
        "halo-breathe": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.06)" },
        },
        "escalation-breathe": {
          "0%, 100%": {
            opacity: "1",
            textShadow: "0 0 8px #FF0000, 0 0 16px rgba(255,0,0,0.6)",
          },
          "50%": {
            opacity: "1",
            textShadow: "0 0 14px #FF0000, 0 0 28px rgba(255,0,0,0.8)",
          },
        },
        "gold-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 8px rgba(212, 175, 55, 0.5), 0 0 16px rgba(212, 175, 55, 0.2)",
            opacity: "1",
          },
          "50%": {
            boxShadow: "0 0 16px rgba(212, 175, 55, 0.8), 0 0 32px rgba(212, 175, 55, 0.4)",
            opacity: "1",
          },
        },
        "text-shimmer": {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "aura-pulse": "aura-pulse 2.5s ease-in-out infinite",
        "halo-breathe": "halo-breathe 2.4s ease-in-out infinite",
        "text-shimmer": "text-shimmer 3s linear infinite",
        "escalation-breathe": "escalation-breathe 2s ease-in-out infinite",
        "gold-pulse": "gold-pulse 2s ease-in-out infinite",
      },
      fontSize: {
        "7xl": "4.5rem",
        "8xl": "6rem",
        "9xl": "8rem",
      },
      boxShadow: {
        /* Design-system gold glows — use as shadow-gold-sm, shadow-gold-md, shadow-gold-lg */
        "gold-sm": "var(--shadow-gold-sm)",
        "gold-md": "var(--shadow-gold-md)",
        "gold-lg": "var(--shadow-gold-lg)",
        /* Neumorphic paired shadows (dark bottom-right + light top-left) */
        "neu-sm":      "var(--neu-shadow-raised-sm)",
        neu:           "var(--neu-shadow-raised)",
        "neu-lg":      "var(--neu-shadow-raised-lg)",
        "neu-inset":   "var(--neu-shadow-inset)",
        "neu-pressed": "var(--neu-shadow-pressed)",
      },
      borderRadius: {
        /* Design-system radii */
        card:  "var(--radius-card)",
        panel: "var(--radius-panel)",
        /* Neumorphic PEBBLE scale */
        "neu-card":  "var(--neu-radius-card)",
        "neu-panel": "var(--neu-radius-panel)",
        "neu-field": "var(--neu-radius-field)",
        "neu-tile":  "var(--neu-radius-tile)",
        "neu-chip":  "var(--neu-radius-chip)",
      },
    },
  },
  plugins: [],
};

export default config;
