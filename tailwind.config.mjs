/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d0d0d",
        "ink-soft": "#1a1814",
        smoke: "#f5f4f1",
        gold: "#b8954a",
        "gold-light": "#e8d9b5",
        mid: "#6b6b6b",
        rule: "#d8d4cc",
      },
      fontFamily: {
        serif: ["'Cormorant Garamond'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["clamp(3rem, 8vw, 7rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "display-sm": ["clamp(2.25rem, 5vw, 3.5rem)", { lineHeight: "1.08" }],
      },
      letterSpacing: {
        label: "0.28em",
        wide: "0.18em",
      },
      maxWidth: {
        content: "1100px",
        wide: "1320px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 6s linear infinite",
      },
    },
  },
  plugins: [],
};
