import type { Metadata } from "next";
import { getSession } from "@/core/auth/session";
import { Container } from "@/core/ui/components/Container";
import { PoleHeader } from "@/core/ui/components/PolePage";
import { listForMember as letters } from "@/modules/lettre/data/letters";
import { listForMember as santas } from "@/modules/santa/data/events";
import { listForMember as birthdays } from "@/modules/anniversaire/data";
import { listForMember as newYears } from "@/modules/nouvel-an/data";
import { CHRISTMAS, GameRows, RunningList, type Game, type Running } from "../jeux/games";

const NEW_YEAR: Game = { href: "/celebrer/nouvel-an", icon: "🥂", name: "Nouvel an", line: "Le réveillon à plusieurs : invités, qui fait quoi, listes calculées, budget et paiements.", color: "#ff3ec9" };
const BIRTHDAY: Game = { href: "/celebrer/anniversaires", icon: "🎂", name: "Un anniversaire", line: "Le cadeau d'un ami, préparé à plusieurs dans son dos : idées, pouces, prix partagé.", color: "#ffcc29" };

export const metadata: Metadata = { title: "Célébrer" };

/** Célébrer: the birthdays, Secret Santas and children's letters you have going, then the three. */
export default async function CelebrerPage() {
  const me = (await getSession())!.member.id;
  const [santa, lettres, anniv, nye] = await Promise.all([santas(me), letters(me), birthdays(me), newYears(me)]);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const [santaGame, lettreGame] = CHRISTMAS;
  const running: Running[] = [
    ...nye.filter((e) => e.endsOn >= today).map((e) => ({ key: `n-${e.code}`, game: NEW_YEAR, text: `${e.title}${e.organizer ? " · tu organises" : " · tu es invité·e"}`, href: `/celebrer/nouvel-an/${e.code}` })),
    ...anniv.filter((b) => b.date >= today).map((b) => ({ key: `b-${b.id}`, game: BIRTHDAY, text: `Anniversaire de ${b.name}${b.mine ? " · tu l'organises" : ""}`, href: `/celebrer/anniversaires/${b.id}` })),
    ...santa.organized.filter((e) => !e.archivedAt).map((e) => ({ key: `s-${e.id}`, game: santaGame!, text: `${e.title} · tu l'organises`, href: `/santa/${e.code}/panneau` })),
    ...santa.participating.map((p) => ({ key: `sp-${p.token}`, game: santaGame!, text: `${p.title} · ta page`, href: `/santa/moi/${p.token}` })),
    ...lettres.filter((l) => !l.closedAt).map((l) => ({ key: `l-${l.id}`, game: lettreGame!, text: l.title, href: `/lettre/${l.code}/panneau` })),
  ];
  return (
    <Container size="md">
      <PoleHeader pole="celebrer" />
      <RunningList running={running} />
      <GameRows label="Toute l'année" games={[BIRTHDAY, NEW_YEAR]} />
      <GameRows label="Pour Noël" games={CHRISTMAS} />
    </Container>
  );
}
