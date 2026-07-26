import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const bricolage = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/bricolage-grotesque-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LE CLHUB",
  description: "Le club, en ligne.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ground text-ink">{children}</body>
    </html>
  );
}
