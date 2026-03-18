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
      },
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "Cinzel", "serif"],
        playfair: ["var(--font-playfair)", "serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        edu: ["var(--font-edu)", "'Edu AU VIC WA NT Hand Arrows'", "cursive"],
        baskerville: ["var(--font-libre-baskerville)", "serif"],
        montserrat: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
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
    },
  },
  plugins: [],
};

export default config;
