import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { buzzerQrSvg } from "@/core/qrcode";
import { getRoom, viewOf } from "@/modules/jeux/data/buzzerRooms";
import { BuzzerLogo } from "../../BuzzerLogo";
import { HostScreen } from "./HostScreen";

export const metadata: Metadata = {
  title: "Buzzer (animateur) — LE CLHUB",
  robots: { index: false, follow: false },
};

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-ground p-6 text-center text-ink">
      <BuzzerLogo className="h-20 w-20" />
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      <p className="max-w-md text-muted">{children}</p>
      <Link href="/jeux/buzzer" className="glow-box-primary rounded-xl bg-primary px-5 py-3 font-bold text-primary-ink">
        Retour au buzzer
      </Link>
    </main>
  );
}

/**
 * The screen you project: QR code while teams join, then scores and the
 * controls. Lives outside the (club) layout on purpose — no header, the
 * whole window belongs to the game — so it does its own sign-in check.
 */
export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { code } = await params;
  const room = getRoom(code);
  if (!room) {
    return (
      <Message title="Partie introuvable">
        Cette partie est terminée, ou le site a été mis à jour depuis son lancement. Tu peux en lancer une nouvelle.
      </Message>
    );
  }

  if (room.hostMemberId !== session.member.id && !(await isAdminModeActive())) {
    return <Message title="Pas ta partie">Cette partie a été lancée par {room.hostName} : seul l&apos;animateur peut la piloter.</Message>;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const joinUrl = `${appUrl}/buzzer/${room.code}`;

  return (
    <HostScreen
      code={room.code}
      hostName={room.hostName}
      initialView={viewOf(room)}
      qrSvg={await buzzerQrSvg(joinUrl)}
      joinUrl={joinUrl}
    />
  );
}
