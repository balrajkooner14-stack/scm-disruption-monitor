// Single source of truth for the product name and raw brand colours.
// A rename after trademark checks should be a one-file change here.
export const BRAND = {
  name: "Foreglow",
  descriptor: "Supply chain risk intelligence",
  tagline: "See it coming.",
  description:
    "Foreglow reads the news, weather and trade policy that touch your suppliers, then shows which products are exposed and what to do next.",
} as const

/** Raw hex for places Tailwind classes cannot reach: SVG attributes, Recharts props, jsPDF. */
export const COLOR = {
  paper: "#F4EFE6",
  paperRaised: "#FBF8F2",
  paperSunk: "#EFE7D9",
  surface: "#FFFFFF",
  ink: "#1B2330",
  ink2: "#3E4955",
  ink3: "#5A6470",
  line: "#DDD5C6",
  lineSoft: "#E6DFD2",
  lineStrong: "#C9C0AF",
  ember: "#B04A22",
  emberDeep: "#8A3A1A",
  dawn: "#E0A077",
  ochreBar: "#C4973B",
  sea: "#4F6B78",
  moss: "#3F6B4C",
  heat0: "#E6DFD2",
  heat1: "#F0CFB6",
  heat2: "#E3A27E",
  heat3: "#C8704A",
  onInk: "#F4EFE6",
} as const
