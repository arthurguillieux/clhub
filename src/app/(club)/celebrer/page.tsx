import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PoleHeader } from "@/core/ui/components/PolePage";
import { listForMember as letters } from "@/modules/lettre/data/letters";
import { listForMember as santas } from "@/modules/santa/data/events";
import { CHRISTMAS, GameRows, RunningList, type Running } from "../jeux/games";

export const metadata: Metadata = { title: "Célébrer" };

/** Célébrer: your Secret Santas and children's letters going, then the two. */
export default async function CelebrerPage() {
  const me = (await getSession())!.member.id;
  const [santa, lettres] = await Promise.all([santas(me), letters(me)]);
  const [santaGame, lettreGame] = CHRISTMAS;
  const running: Running[] = [
    ...santa.organized.filter((e) => !e.archivedAt).map((e) => ({ key: `s-${e.id}`, game: santaGame!, text: `${e.title} · tu l'organises`, href: `/santa/${e.code}/panneau` })),
    ...santa.participating.map((p) => ({ key: `sp-${p.token}`, game: santaGame!, text: `${p.title} · ta page`, href: `/santa/moi/${p.token}` })),
    ...lettres.filter((l) => !l.closedAt).map((l) => ({ key: `l-${l.id}`, game: lettreGame!, text: l.title, href: `/lettre/${l.code}/panneau` })),
  ];
  return (
    <Container size="md">
      <PoleHeader pole="celebrer" />
      <RunningList running={running} />
      <GameRows label="Pour Noël" games={CHRISTMAS} />
    </Container>
  );
}
