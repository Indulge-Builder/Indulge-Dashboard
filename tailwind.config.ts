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
        champagne: "#F7E7CE",
        // Quiet Luxury extension palette
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
        playfair: ["var(--font-playfair)", "serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        edu: ["var(--font-google-sans)", "sans-serif"],
        baskerville: ["var(--font-libre-baskerville)", "serif"],
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        // Celebration overlay — avatar halo breathe
        "halo-breathe": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.06)" },
        },
        // Celebration text shimmer
        "text-shimmer": {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "halo-breathe": "halo-breathe 2.4s ease-in-out infinite",
        "text-shimmer": "text-shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
