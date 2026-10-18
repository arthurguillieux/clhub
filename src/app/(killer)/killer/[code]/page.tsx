import type { Metadata, Viewport } from "next";
import { PlayerScreen } from "./PlayerScreen";

export const metadata: Metadata = { title: "Killer", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#080505", maximumScale: 1, userScalable: false };

/**
 * Public on purpose: this is where the QR code lands, and guests have no
 * account. A phone only ever learns its own target and mission.
 */
export default async function KillerPlayerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerScreen code={code.toUpperCase()} />;
}
