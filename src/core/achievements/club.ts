import { sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import type { PoleId } from "@/core/ui/sections";

/**
 * The club's life in all its variety, pole by pole — for the year's Wrapped and for a member's
 * page. Counted straight from each module's tables (most modules don't write to the activity feed).
 * Never the birthdays: the person celebrated must not be able to guess anything, even from a count.
 */

export interface Stat {
  n: number;
  /** The words after the number, singular and plural. */
  one: string;
  many: string;
}

export interface PoleLife {
  pole: PoleId;
  stats: Stat[];
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const s = (n: unknown, one: string, many: string): Stat => ({ n: num(n), one, many });
/** The poles with at least one thing to say, their empty lines left out. */
const keep = (poles: PoleLife[]) => poles.map((p) => ({ ...p, stats: p.stats.filter((x) => x.n > 0) })).filter((p) => p.stats.length > 0);

export const statLabel = (x: Stat) => (x.n > 1 ? x.many : x.one);

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** A year of the club: every pole, the liveliest month, the newcomers. */
export async function clubYear(year: number): Promise<{ poles: PoleLife[]; spentCents: number; busiestMonth: { label: string; count: number } | null; newMembers: number }> {
  const d0 = `${year}-01-01`;
  const d1 = `${year + 1}-01-01`;
  const t0 = sql`${d0}::timestamptz`;
  const t1 = sql`${d1}::timestamptz`;
  const res = await db.execute(sql`
    select
      (select count(*) from booking b where b.status in ('active', 'returned') and b.start_date >= ${d0} and b.start_date < ${d1}) as loans,
      (select count(*) from don_listing d where d.status = 'completed' and d.created_at >= ${t0} and d.created_at < ${t1}) as dons,
      (select count(*) from menu_event m where m.event_date >= ${d0} and m.event_date < ${d1}) as potlucks,
      (select count(*) from meal_guest g join menu_event m on m.id = g.event_id where g.status = 'yes' and m.event_date >= ${d0} and m.event_date < ${d1}) as guests,
      (select count(*) from meal_item i join menu_event m on m.id = i.event_id where m.event_date >= ${d0} and m.event_date < ${d1}) as dishes,
      (select count(*) from recipe r where r.created_at >= ${t0} and r.created_at < ${t1}) as recipes,
      (select count(*) from club_event e where e.event_date >= ${d0} and e.event_date < ${d1}) as events,
      (select count(*) from expense_event x where x.created_at >= ${t0} and x.created_at < ${t1}) as caisses,
      (select coalesce(sum(e.amount_cents), 0) from expense e where e.created_at >= ${t0} and e.created_at < ${t1}) as spent,
      (select count(*) from wolf_game g where g.status <> 'setup' and coalesce(g.started_at, g.created_at) >= ${t0} and coalesce(g.started_at, g.created_at) < ${t1}) as wolves,
      (select count(*) from killer_game k where k.started_at >= ${t0} and k.started_at < ${t1}) as killers,
      (select count(*) from scenario_game c where c.simulated = false and c.started_at >= ${t0} and c.started_at < ${t1}) as scenarios,
      (select count(*) from santa_event e where e.launched_at >= ${t0} and e.launched_at < ${t1}) as santas,
      (select count(*) from santa_participant p join santa_event e on e.id = p.event_id where e.launched_at >= ${t0} and e.launched_at < ${t1}) as santa_people,
      (select count(*) from letter l where l.year = ${year}) as letters,
      (select count(*) from nye_edition n where n.starts_on >= ${d0} and n.starts_on < ${d1}) as nyes,
      (select count(*) from nye_guest g join nye_edition n on n.id = g.edition_id where g.answer = 'yes' and n.starts_on >= ${d0} and n.starts_on < ${d1}) as nye_people,
      (select count(*) from member m where m.joined_at >= ${t0} and m.joined_at < ${t1}) as new_members
  `);
  const r = (res.rows[0] ?? {}) as Record<string, unknown>;
  const months = await db.execute(sql`
    select extract(month from d)::int as m, count(*)::int as n from (
      select b.created_at as d from booking b
      union all select d.created_at from don_listing d
      union all select m.event_date::timestamptz from menu_event m
      union all select r.created_at from recipe r
      union all select e.event_date::timestamptz from club_event e
      union all select x.created_at from expense_event x
      union all select coalesce(g.started_at, g.created_at) from wolf_game g where g.status <> 'setup'
      union all select k.started_at from killer_game k where k.started_at is not null
      union all select c.started_at from scenario_game c where c.simulated = false and c.started_at is not null
      union all select e.launched_at from santa_event e where e.launched_at is not null
      union all select n.starts_on::timestamptz from nye_edition n
    ) t where d >= ${t0} and d < ${t1} group by 1 order by 2 desc, 1 limit 1
  `);
  const top = months.rows[0] as { m?: number; n?: number } | undefined;
  return {
    poles: keep([
      { pole: "partager", stats: [s(r.loans, "prêt", "prêts"), s(r.dons, "don qui a trouvé preneur", "dons qui ont trouvé preneur")] },
      { pole: "manger", stats: [s(r.potlucks, "potluck", "potlucks"), s(r.guests, "convive", "convives"), s(r.dishes, "plat apporté", "plats apportés"), s(r.recipes, "recette ajoutée au carnet", "recettes ajoutées au carnet")] },
      { pole: "retrouver", stats: [s(r.events, "date à l'agenda", "dates à l'agenda"), s(r.caisses, "caisse commune", "caisses communes")] },
      { pole: "jouer", stats: [s(r.wolves, "partie de loups-garous", "parties de loups-garous"), s(r.killers, "Killer", "Killers"), s(r.scenarios, "soirée scénario", "soirées scénario")] },
      { pole: "celebrer", stats: [s(r.santas, "Secret Santa", "Secret Santa"), s(r.santa_people, "cadeau tiré au sort", "cadeaux tirés au sort"), s(r.letters, "lettre au Père Noël", "lettres au Père Noël"), s(r.nyes, "nouvel an", "nouvels ans"), s(r.nye_people, "réveillonneur", "réveillonneurs")] },
    ]),
    spentCents: num(r.spent),
    busiestMonth: top?.m ? { label: MONTHS[top.m - 1] ?? "?", count: num(top.n) } : null,
    newMembers: num(r.new_members),
  };
}

/** A member's life at the club, all years together: what they shared, cooked, gathered, played, celebrated. */
export async function memberLife(memberId: string): Promise<PoleLife[]> {
  const res = await db.execute(sql`
    select
      (select count(*) from booking b join item i on i.id = b.item_id where i.owner_id = ${memberId} and b.status in ('active', 'returned')) as lent,
      (select count(*) from booking b where b.borrower_id = ${memberId} and b.status in ('active', 'returned')) as borrowed,
      (select count(*) from don_listing d where d.created_by_id = ${memberId}) as dons,
      (select count(*) from menu_event m where m.created_by_id = ${memberId}) as potlucks_hosted,
      (select count(*) from meal_guest g join menu_event m on m.id = g.event_id where g.member_id = ${memberId} and g.status = 'yes' and m.created_by_id <> ${memberId}) as potlucks_joined,
      (select count(*) from recipe r where r.created_by_id = ${memberId}) as recipes,
      (select count(*) from club_event e where e.created_by_id = ${memberId}) as events,
      (select count(*) from event_participant p where p.member_id = ${memberId}) as caisses,
      (select count(distinct s.game_id) from wolf_seat s join wolf_player p on p.id = s.player_id join wolf_game g on g.id = s.game_id where p.member_id = ${memberId} and g.status <> 'setup') as wolves_played,
      (select count(*) from wolf_game g where g.host_member_id = ${memberId} and g.status <> 'setup') as wolves_hosted,
      (select count(*) from killer_game k where k.host_member_id = ${memberId} and k.started_at is not null) as killers,
      (select count(*) from scenario_game c where c.host_member_id = ${memberId} and c.simulated = false and c.started_at is not null) as scenarios,
      (select count(*) from santa_participant p join santa_event e on e.id = p.event_id where p.member_id = ${memberId} and e.status = 'launched') as santas,
      (select count(*) from letter l where l.host_member_id = ${memberId}) as letters,
      (select count(*) from nye_guest g where g.member_id = ${memberId} and g.answer = 'yes') as nyes
  `);
  const r = (res.rows[0] ?? {}) as Record<string, unknown>;
  return keep([
    { pole: "partager", stats: [s(r.lent, "prêt de ses objets", "prêts de ses objets"), s(r.borrowed, "emprunt", "emprunts"), s(r.dons, "don proposé", "dons proposés")] },
    { pole: "manger", stats: [s(r.potlucks_hosted, "potluck organisé", "potlucks organisés"), s(r.potlucks_joined, "potluck rejoint", "potlucks rejoints"), s(r.recipes, "recette partagée", "recettes partagées")] },
    { pole: "retrouver", stats: [s(r.events, "date proposée à l'agenda", "dates proposées à l'agenda"), s(r.caisses, "caisse commune", "caisses communes")] },
    { pole: "jouer", stats: [s(r.wolves_played, "partie de loups-garous", "parties de loups-garous"), s(r.wolves_hosted, "partie menée", "parties menées"), s(r.killers, "Killer organisé", "Killers organisés"), s(r.scenarios, "soirée scénario menée", "soirées scénario menées")] },
    { pole: "celebrer", stats: [s(r.santas, "Secret Santa", "Secret Santa"), s(r.letters, "lettre au Père Noël", "lettres au Père Noël"), s(r.nyes, "nouvel an", "nouvels ans")] },
  ]);
}
