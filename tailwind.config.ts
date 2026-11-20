import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          hover: "#C3F53C",
          dark: "#B2E628",
        },
        expense: {
          DEFAULT: "var(--expense)",
          foreground: "#FFFFFF",
        },
        savings: {
          DEFAULT: "var(--savings)",
          foreground: "#FFFFFF",
        },
        chart: {
          1: "#8CCBFF",
          2: "#6B72FF",
          3: "#5BAA6B",
          4: "#8A8A8A",
          5: "#D4FF5A",
          6: "#FFB04A",
          7: "#FF7B7B",
        },
      },
      borderRadius: {
        card: "12px",
        pill: "999px",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "'Nunito'", "'Outfit'", "sans-serif"],
        heading: ["'Plus Jakarta Sans'", "'Outfit'", "'Nunito'", "sans-serif"],
        brand: ["'Fredoka'", "'Nunito'", "'Plus Jakarta Sans'", "sans-serif"],
      },
      textColor: {
        accent: "var(--accent-text)",
      },
      borderColor: {
        accent: "var(--accent-border)",
      },
    },
  },
  plugins: [],
};

export default config;
