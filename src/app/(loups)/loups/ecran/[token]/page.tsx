import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { buzzerQrSvg } from "@/core/qrcode";
import { getGameByToken, getScreenView } from "@/modules/loups/data/games";
import { Screen } from "./Screen";

export const metadata: Metadata = { title: "Loups-garous", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#141011" };

/** The room's screen, on a projector: public facts only. The meneur opens it from their phone. */
export default async function ScreenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const game = await getGameByToken(token);
  if (!game) notFound();
  const view = await getScreenView(game);
  return <Screen token={token} initial={view} qrSvg={await buzzerQrSvg(view.link)} />;
}
