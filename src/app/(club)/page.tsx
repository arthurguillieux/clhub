import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listRecentActivityWithActors, type ActivityWithActor } from "@/core/activity";
import { listNotifications } from "@/core/notifications";
import type { ActivityEntry, Notification } from "@/core/db/schema";
import { Container } from "@/core/ui/components/Container";
import { GroupLabel, PageTitle } from "@/core/ui/components/Heading";
import { SectionTile } from "@/core/ui/components/SectionIcon";
import { Card } from "@/core/ui/components/Card";
import { categoryLabel } from "@/core/ui/categories";
import { POLES, sectionById, sectionOfActivity, type SectionId } from "@/core/ui/sections";
import { listBookingsByBorrower, listPendingRequestsForOwner } from "@/modules/pretotheque/data/bookings";
import { listMealsFor } from "@/modules/repas/data/meals";
import { formatFrench, type CalendarDate } from "@/core/date";
import { getLatestChangelogDay } from "@/modules/changelog/data/entries";
import { offerSentence } from "@/modules/lettre/domain/letter";
import { RelativeTime } from "@/core/ui/components/RelativeTime";
import { markAllNotificationsReadAction } from "./actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "LE CLHUB" } };

const RECENT_ACTIVITY_SHOWN = 3;

function describeActivity(a: ActivityEntry): string {
  switch (a.kind) {
    case "member.joined": {
      const p = a.payload as { memberNumber?: number };
      return `Un nouveau membre a rejoint le club — #${p.memberNumber ?? "?"}`;
    }
    case "item.created": {
      const p = a.payload as { name?: string; category?: string };
      return `${p.name ?? "Un objet"} a rejoint la prêtothèque${p.category ? ` (${categoryLabel(p.category)})` : ""}`;
    }
    case "booking.requested": {
      const p = a.payload as { itemName?: string };
      return `Une demande de prêt a été faite pour ${p.itemName ?? "un objet"}.`;
    }
    case "booking.approved": {
      const p = a.payload as { itemName?: string };
      return `${p.itemName ?? "Un objet"} a été réservé.`;
    }
    case "booking.rejected": {
      const p = a.payload as { itemName?: string };
      return `Une demande pour ${p.itemName ?? "un objet"} a été refusée.`;
    }
    case "booking.picked-up": {
      const p = a.payload as { itemName?: string };
      return `${p.itemName ?? "Un objet"} a été récupéré par l'emprunteur.`;
    }
    case "booking.returned": {
      const p = a.payload as { itemName?: string };
      return `${p.itemName ?? "Un objet"} a été rendu.`;
    }
    case "item.issue-reported": {
      const p = a.payload as { itemName?: string };
      return `Un problème a été signalé sur ${p.itemName ?? "un objet"}.`;
    }
    case "item.repaired": {
      const p = a.payload as { itemName?: string };
      return `${p.itemName ?? "Un objet"} est de nouveau disponible après réparation.`;
    }
    case "booking.expired": {
      const p = a.payload as { itemName?: string };
      return `Une demande pour ${p.itemName ?? "un objet"} a expiré, faute de réponse à temps.`;
    }
    case "wanted.posted": {
      const p = a.payload as { title?: string };
      return `Une recherche a été publiée : « ${p.title ?? "?"} ».`;
    }
    case "menu.proposed": {
      const p = a.payload as { title?: string; eventDate?: string };
      const dateLabel = p.eventDate ? ` (${formatFrench(p.eventDate as CalendarDate)})` : "";
      return `Un repas ouvert à tous : « ${p.title ?? "?"} »${dateLabel}.`;
    }
    case "caisse.event-created": {
      const p = a.payload as { name?: string };
      return `Un nouvel évènement de caisse a été créé : « ${p.name ?? "?"} ».`;
    }
    case "recipe.added": {
      const p = a.payload as { title?: string };
      return `Une nouvelle recette a rejoint le carnet : « ${p.title ?? "?"} ».`;
    }
    case "don.posted": {
      const p = a.payload as { title?: string };
      return `Une nouvelle annonce dans les Cabanes à dons : « ${p.title ?? "?"} ».`;
    }
    case "club-event.added": {
      const p = a.payload as { title?: string; eventDate?: string };
      const dateLabel = p.eventDate ? ` (${formatFrench(p.eventDate as CalendarDate)})` : "";
      return `Un évènement a été ajouté à l'agenda : « ${p.title ?? "?"} »${dateLabel}.`;
    }
    default:
      return a.kind;
  }
}

/** Where a notification leads, for those that lead somewhere. */
function notificationHref(n: Notification): string | null {
  const code = (n.payload as { code?: unknown }).code;
  if (n.kind === "bug.report") return "/admin/bugs";
  const mealId = (n.payload as { mealId?: unknown }).mealId;
  if (n.kind.startsWith("meal.") && typeof mealId === "string" && /^[0-9a-f-]{36}$/i.test(mealId)) return `/repas/${mealId}`;
  return n.kind.startsWith("lettre.") && typeof code === "string" && /^[A-Z0-9]{6}$/.test(code) ? `/lettre/${code}/panneau` : null;
}

function describeNotification(n: Notification): string {
  switch (n.kind) {
    case "invitation.accepted": {
      const p = n.payload as { newMemberName?: string; newMemberNumber?: number };
      return `${p.newMemberName ?? "Quelqu'un"} a rejoint le club grâce à toi (membre #${p.newMemberNumber ?? "?"})`;
    }
    case "booking.requested": {
      const p = n.payload as { itemName?: string };
      return `Une demande de prêt pour ${p.itemName ?? "un objet"} attend ta validation.`;
    }
    case "booking.auto-approved": {
      const p = n.payload as { itemName?: string };
      return `${p.itemName ?? "Un objet"} vient d'être réservé automatiquement.`;
    }
    case "booking.approved": {
      const p = n.payload as { itemName?: string };
      return `Ta demande pour ${p.itemName ?? "un objet"} a été acceptée !`;
    }
    case "booking.rejected": {
      const p = n.payload as { itemName?: string };
      return `Ta demande pour ${p.itemName ?? "un objet"} a été refusée.`;
    }
    case "booking.cancelled": {
      const p = n.payload as { itemName?: string };
      return `Une demande pour ${p.itemName ?? "un objet"} a été annulée.`;
    }
    case "booking.picked-up": {
      const p = n.payload as { itemName?: string };
      return `${p.itemName ?? "Ton objet"} a été récupéré par l'emprunteur.`;
    }
    case "booking.returned": {
      const p = n.payload as { itemName?: string };
      return `${p.itemName ?? "Ton objet"} a été rendu.`;
    }
    case "item.issue-reported": {
      const p = n.payload as { itemName?: string; note?: string };
      return `Un problème a été signalé sur ${p.itemName ?? "un objet"}${p.note ? ` : « ${p.note} »` : ""}.`;
    }
    case "booking.expired": {
      const p = n.payload as { itemName?: string };
      return `Ta demande pour ${p.itemName ?? "un objet"} a expiré, faute de réponse à temps — retente si besoin.`;
    }
    case "booking.dates-changed": {
      const p = n.payload as { itemName?: string; startDate?: string; endDate?: string };
      const dates =
        p.startDate && p.endDate
          ? ` (${formatFrench(p.startDate as CalendarDate)} → ${formatFrench(p.endDate as CalendarDate)})`
          : "";
      return `Les dates d'un emprunt de ${p.itemName ?? "un objet"} ont changé${dates} — la demande repasse en attente de ta validation.`;
    }
    case "booking.pickup-reminder": {
      const p = n.payload as { itemName?: string; startDate?: string };
      const dateLabel = p.startDate ? ` (${formatFrench(p.startDate as CalendarDate)})` : "";
      return `Récupération de ${p.itemName ?? "ton emprunt"} demain${dateLabel} !`;
    }
    case "wanted.group-buy": {
      const p = n.payload as { title?: string; interestCount?: number };
      return `On est ${p.interestCount ?? "plusieurs"} intéressés par « ${p.title ?? "?"} » — on l'achète ensemble ?`;
    }
    case "waitlist.available": {
      const p = n.payload as { itemName?: string; startDate?: string; endDate?: string };
      const dates =
        p.startDate && p.endDate
          ? ` (${formatFrench(p.startDate as CalendarDate)} → ${formatFrench(p.endDate as CalendarDate)})`
          : "";
      return `${p.itemName ?? "L'objet"} attendu s'est libéré${dates} — retente ta demande !`;
    }
    case "achievement.unlocked": {
      const p = n.payload as { name?: string; icon?: string };
      return `${p.icon ?? "🏅"} Nouvel écusson débloqué : ${p.name ?? "?"} !`;
    }
    case "menu.response": {
      const p = n.payload as { memberName?: string };
      return `${p.memberName ?? "Quelqu'un"} vient à ton repas.`;
    }
    case "meal.response": {
      const p = n.payload as { name?: string; title?: string };
      return `🍽️ ${p.name ?? "Quelqu'un"} vient à ton potluck « ${p.title ?? "?"} ».`;
    }
    case "meal.invited":
    case "meal.nudge":
    case "meal.reminder": {
      const p = n.payload as { text?: string; title?: string };
      return `🍽️ ${p.text ?? p.title ?? "Un potluck"}`;
    }
    case "don.interest": {
      const p = n.payload as { memberName?: string; title?: string };
      return `${p.memberName ?? "Quelqu'un"} est intéressé·e par ton annonce « ${p.title ?? "?"} ».`;
    }
    case "lettre.offer":
    case "lettre.withdraw": {
      const p = n.payload as { name?: string; giftTitle?: string; childName?: string; amountCents?: number | null; by?: string | null };
      return offerSentence({
        type: n.kind === "lettre.offer" ? "offer" : "withdraw",
        name: p.name ?? "Quelqu'un",
        giftTitle: p.giftTitle ?? "?",
        childName: p.childName ?? "l'enfant",
        amountCents: typeof p.amountCents === "number" ? p.amountCents : null,
        by: typeof p.by === "string" ? p.by : null,
      });
    }
    case "bug.report": {
      const p = n.payload as { name?: string; page?: string | null; excerpt?: string };
      return `🐞 ${p.name ?? "Un membre"} signale un bug${p.page ? ` sur ${p.page}` : ""} : « ${p.excerpt ?? "…"} »`;
    }
    case "don.reserved": {
      const p = n.payload as { title?: string };
      return `« ${p.title ?? "?"} » a été réservé pour toi — contacte le donateur pour récupérer !`;
    }
    default:
      return n.kind;
  }
}

const today = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });
const shortDay = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));

/** One line of « Pour toi »: what needs you, its section's colour, one tap to it. */
interface ForYou {
  key: string;
  section: SectionId | null;
  text: React.ReactNode;
  href: string | null;
}

/**
 * Home, the admins' synthesis (24/11/2026): what needs you pinned on top, then the club's feed with
 * the latest news in it; the sections are the shortcut bar at the bottom (on a computer, a row of tiles).
 */
export default async function HomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx
  const me = session.member.id;

  const [activityEntries, notifications, latestChangelogDay, borrowings, requests, meals] = await Promise.all([
    listRecentActivityWithActors(20),
    listNotifications(me, 20),
    getLatestChangelogDay(),
    listBookingsByBorrower(me),
    listPendingRequestsForOwner(me),
    listMealsFor(me, false),
  ]);
  const unread = notifications.filter((n) => !n.readAt);
  const todayIso = new Date().toISOString().slice(0, 10);

  const forYou: ForYou[] = [
    ...borrowings
      .filter((b) => b.status === "active")
      .map((b) => ({ key: `b-${b.id}`, section: "pretotheque" as const, href: "/pretotheque/mine", text: <>{b.itemName} : <b>à rendre {b.endDate < todayIso ? "(en retard)" : `le ${shortDay(b.endDate)}`}</b></> })),
    ...borrowings
      .filter((b) => b.status === "approved" && b.startDate >= todayIso)
      .slice(0, 2)
      .map((b) => ({ key: `p-${b.id}`, section: "pretotheque" as const, href: "/pretotheque/mine", text: <>{b.itemName} : <b>à récupérer le {shortDay(b.startDate)}</b></> })),
    ...requests.map((r) => ({ key: `r-${r.id}`, section: "pretotheque" as const, href: "/pretotheque/mine", text: <>{r.borrowerName} voudrait emprunter <b>{r.itemName}</b></> })),
    ...meals
      .filter((m) => m.upcoming && m.invited && m.myClaims === 0)
      .slice(0, 3)
      .map((m) => ({ key: `m-${m.id}`, section: "repas" as const, href: `/repas/${m.id}`, text: <>{m.title} ({shortDay(m.date)}) : <b>tu ne ramènes rien encore</b></> })),
    ...unread.slice(0, 6).map((n) => ({ key: `n-${n.id}`, section: null, href: notificationHref(n), text: describeNotification(n) })),
  ];
  const olderNotifications = notifications.filter((n) => n.readAt);
  const recentActivity = activityEntries.slice(0, RECENT_ACTIVITY_SHOWN);
  const olderActivity = activityEntries.slice(RECENT_ACTIVITY_SHOWN);

  return (
    <Container>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted first-letter:uppercase">{today.format(new Date())}</p>
        <PageTitle>Salut {session.user.name} !</PageTitle>
      </header>

      {/* On a computer, the five verbs as tiles (on a phone, they're the bar at the bottom). */}
      <nav aria-label="Le club" className="mt-6 hidden grid-cols-5 gap-2 md:grid">
        {POLES.map((p) => (
          <Link key={p.id} href={p.href} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-sm text-ink hover:bg-surface">
            <SectionTile id={p.id} size={56} />
            {p.name}
          </Link>
        ))}
      </nav>

      <section aria-label="Pour toi" className="mt-6 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <GroupLabel>Pour toi</GroupLabel>
          {unread.length > 0 && (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="-my-2.5 py-2.5 text-xs font-semibold text-primary hover:underline">
                Tout marquer comme lu
              </button>
            </form>
          )}
        </div>
        {forYou.length === 0 ? (
          <p className="rounded-card border border-line-soft px-4 py-3 text-sm text-muted">Rien ne t&apos;attend : profite.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {forYou.map((f) => (
              <li key={f.key}>
                <ForYouRow item={f} />
              </li>
            ))}
          </ul>
        )}
        {olderNotifications.length > 0 && (
          <FoldedList label={`Notifications déjà lues (${olderNotifications.length})`}>
            {olderNotifications.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </FoldedList>
        )}
      </section>

      <section aria-label="Dans le club" className="mt-8 flex flex-col gap-2.5">
        <GroupLabel>Dans le club</GroupLabel>
        {latestChangelogDay && (
          <Link href="/nouveautes" className="group flex flex-col gap-1.5 rounded-card border border-[#4a2d6b] bg-[#1a1424] p-4">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-[#d9a6ff] uppercase">Nouveau dans le CLHUB · {formatFrench(latestChangelogDay.date as CalendarDate)}</span>
            <span className="line-clamp-4 text-sm leading-relaxed text-ink">{latestChangelogDay.entries[0]}</span>
            <span className="text-sm font-semibold text-[#d9a6ff] group-hover:underline">
              {latestChangelogDay.entries.length > 1 ? `Lire les ${latestChangelogDay.entries.length} nouveautés` : "Toutes les nouveautés"} ›
            </span>
          </Link>
        )}
        {activityEntries.length === 0 ? (
          <p className="text-sm text-muted">Rien pour l&apos;instant.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {recentActivity.map((a) => (
                <li key={a.id}>
                  <ActivityRow entry={a} />
                </li>
              ))}
            </ul>
            {olderActivity.length > 0 && (
              <details className="group">
                <summary className="-mx-1 flex cursor-pointer list-none items-center gap-2 px-1 py-2.5 text-sm font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-90">
                    ▸
                  </span>
                  Voir les {olderActivity.length} autres
                </summary>
                <ul className="flex flex-col gap-2">
                  {olderActivity.map((a) => (
                    <li key={a.id}>
                      <ActivityRow entry={a} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </Container>
  );
}

function ForYouRow({ item }: { item: ForYou }) {
  const s = item.section ? sectionById(item.section) : null;
  const body = (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s?.color ?? "var(--accent)" }} aria-hidden="true" />
      <span className="min-w-0 flex-1">{item.text}</span>
      {item.href && (
        <span className="text-muted" aria-hidden="true">
          ›
        </span>
      )}
    </>
  );
  const cls = "flex min-h-12 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm text-ink";
  const style = s ? { borderColor: `color-mix(in srgb, ${s.color} 35%, transparent)`, background: `color-mix(in srgb, ${s.color} 8%, var(--surface))` } : { borderColor: "var(--line)", background: "var(--surface)" };
  return item.href ? (
    <Link href={item.href} className={`${cls} hover:brightness-110`} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

function NotificationRow({ notification: n }: { notification: Notification }) {
  const href = notificationHref(n);
  return (
    <div className="px-4 py-3 text-sm">
      <p className="text-muted">
        {href ? (
          <Link href={href} className="hover:underline">
            {describeNotification(n)}
          </Link>
        ) : (
          describeNotification(n)
        )}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        <RelativeTime date={n.createdAt} />
      </p>
    </div>
  );
}

const AVATAR_COLORS = ["#ffcc29", "#29e0ff", "#c04dff", "#ff7a29", "#baff29", "#ff3ec9", "#39ffb0"];
const avatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_COLORS.length]!;

/** One entry of the club's feed: who, what, when, and which section (its colour). */
function ActivityRow({ entry: a }: { entry: ActivityWithActor }) {
  const s = sectionOfActivity(a.section);
  const name = a.actorName ?? "Le club";
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3">
      {a.actorImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small avatar
        <img src={a.actorImage} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-ground" style={{ background: avatarColor(name) }} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 text-sm">
        <b className="text-ink">{name}</b>
        <span className="block text-ink/90">{describeActivity(a)}</span>
        <span className="text-xs text-muted">
          <RelativeTime date={a.createdAt} />
          {s && (
            <>
              {" · "}
              <span style={{ color: s.color }}>{s.short}</span>
            </>
          )}
        </span>
      </span>
    </div>
  );
}

/** Native <details>: no script, keyboard-accessible, and the summary reads as one clear control. */
function FoldedList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group mt-1">
      <summary className="-mx-1 flex cursor-pointer list-none items-center gap-2 px-1 py-2.5 text-sm font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-90">
          ▸
        </span>
        {label}
      </summary>
      <Card className="divide-y divide-line-soft">{children}</Card>
    </details>
  );
}
