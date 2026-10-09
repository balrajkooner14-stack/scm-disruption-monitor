import type { Config } from "tailwindcss"

const config: Config = {
  // Light-only (First Light). "class" means OS dark mode can never activate
  // a stray dark: variant.
  darkMode: "class",
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{ts,tsx}", // REQUIRED: lib/ui.ts and lib/categoryTrends.ts hold class strings
  ],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: "#F4EFE6", raised: "#FBF8F2", sunk: "#EFE7D9" },
        surface: "#FFFFFF",
        ink: { DEFAULT: "#1B2330", 2: "#3E4955", 3: "#5A6470" },
        line: { DEFAULT: "#DDD5C6", soft: "#E6DFD2", strong: "#C9C0AF", control: "#8A8272" },
        ember: { DEFAULT: "#B04A22", deep: "#8A3A1A", tint: "#F6E1D6", line: "#E8B9A2" },
        dawn: "#E0A077",
        ochre: { DEFAULT: "#6E4B0C", tint: "#F3E6C8" },
        sea: { DEFAULT: "#4F6B78", deep: "#33505C", tint: "#E3EAEC" },
        moss: { DEFAULT: "#3F6B4C", deep: "#2F5A3C", tint: "#DCE5DE" },
        ai: { DEFAULT: "#7A4A1A", tint: "#F7EBDD" },
        heat: { 0: "#E6DFD2", 1: "#F0CFB6", 2: "#E3A27E", 3: "#C8704A" },
        // Text on bg-ink panels (sign-in live panel, first-light band).
        "on-ink": { DEFAULT: "#F4EFE6", muted: "#C9C2B5" },
      },
      fontFamily: {
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
export default config
