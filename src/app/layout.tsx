import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { KonamiListener } from "@/core/ui/components/KonamiListener";
import { ConsoleEasterEgg } from "@/core/ui/components/ConsoleEasterEgg";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, themeClass } from "@/core/ui/theme";

const bricolage = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/bricolage-grotesque-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  // Each page names itself; the tab reads « Prêtothèque · LE CLHUB ».
  title: { default: "LE CLHUB", template: "%s · LE CLHUB" },
  description: "Le club, en ligne.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CLHUB",
  },
};

/** The phone's browser bar takes the page's ground colour, for the chosen display setting. */
export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  if (theme === "light") return { themeColor: "#f5f4f8" };
  if (theme === "auto")
    return {
      themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f5f4f8" },
        { media: "(prefers-color-scheme: dark)", color: "#08080d" },
      ],
    };
  return { themeColor: "#08080d" };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="fr" className={`${bricolage.variable} ${themeClass(theme)} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ground text-ink">
        {children}
        <ServiceWorkerRegister />
        <KonamiListener />
        <ConsoleEasterEgg />
      </body>
    </html>
  );
}
