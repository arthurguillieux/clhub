import type { Metadata, Viewport } from "next";
import { PlayerBuzzer } from "./PlayerBuzzer";

export const metadata: Metadata = {
  title: "Buzzer — LE CLHUB",
  robots: { index: false, follow: false },
};

// No pinch-zoom or double-tap zoom on a screen that's all about tapping fast.
export const viewport: Viewport = {
  themeColor: "#08080d",
  maximumScale: 1,
  userScalable: false,
};

/**
 * Public on purpose — this is where the QR code lands, and the people
 * scanning it don't need (or have) a CLHUB account. Everything they can do
 * is scoped to the one game whose code is in the URL.
 */
export default async function PlayerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerBuzzer code={code.toUpperCase()} />;
}
