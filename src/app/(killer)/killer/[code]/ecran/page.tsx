import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buzzerQrSvg } from "@/core/qrcode";
import { getPublicView } from "@/modules/killer/data/games";
import { checkKillerHost } from "@/modules/killer/host";
import { TvScreen } from "./TvScreen";

export const metadata: Metadata = { title: "Killer — écran", robots: { index: false, follow: false } };

/** What the TV shows: never a button, never a mission — the organizer drives everything from their phone. */
export default async function KillerTvPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) redirect(check.reason === "signed-out" ? "/sign-in" : "/jeux/killer");

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const joinUrl = `${appUrl}/killer/${check.game.code}`;
  return <TvScreen code={check.game.code} initialView={await getPublicView(check.game)} qrSvg={await buzzerQrSvg(joinUrl)} joinUrl={joinUrl} />;
}
