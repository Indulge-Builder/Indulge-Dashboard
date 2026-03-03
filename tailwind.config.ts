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
      },
      fontFamily: {
        playfair: ["var(--font-playfair)", "serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        marcellus: ["var(--font-marcellus)", "serif"],
        outfit: ["var(--font-outfit)", "sans-serif"],
        edu: ['"Edu AU VIC WA NT Hand Arrows"', "cursive"],
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
