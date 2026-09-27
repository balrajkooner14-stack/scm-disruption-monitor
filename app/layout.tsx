import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Default title/description for pages that don't set their own — /profile,
// /login, /signup and /about all inherit this. Until v4.9 it was still the
// create-next-app scaffold text.
export const metadata: Metadata = {
  title: {
    default: "SCM Disruption Monitor",
    template: "%s | SCM Disruption Monitor",
  },
  description:
    "Real-time supply chain disruption monitoring — trade-press, GDELT, GDACS and NOAA signals scored against your own supplier network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
