import type { Metadata, Viewport } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Self-hosted at build time by next/font — no runtime request to Google.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
  // next/font has no fallback metrics for Newsreader; without this it logs
  // "Failed to find font override values" on every compile.
  adjustFontFallback: false,
});
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

// Default title/description for pages that don't set their own — /profile,
// /login, /signup and /about all inherit this.
export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
};

// First Light is light-only: keep native form controls light even when the
// OS is in dark mode.
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${publicSans.variable}`}>
      <body className="bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
