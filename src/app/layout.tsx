import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaebe1" },
    { media: "(prefers-color-scheme: dark)", color: "#17160f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ground text-ink">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
