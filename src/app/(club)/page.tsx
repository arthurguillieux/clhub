import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listRecentActivity } from "@/core/activity";
import { listNotifications } from "@/core/notifications";
import type { ActivityEntry, Notification } from "@/core/db/schema";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { categoryLabel } from "@/core/ui/categories";
import { CLUB_SECTIONS } from "@/core/ui/sections";
import { formatFrench, type CalendarDate } from "@/core/date";
import { getLatestChangelogDay } from "@/modules/changelog/data/entries";
import { RelativeTime } from "@/core/ui/components/RelativeTime";
import { markAllNotificationsReadAction } from "./actions";

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
      return `Un repas a été proposé : « ${p.title ?? "?"} »${dateLabel}.`;
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
    case "don.interest": {
      const p = n.payload as { memberName?: string; title?: string };
      return `${p.memberName ?? "Quelqu'un"} est intéressé·e par ton annonce « ${p.title ?? "?"} ».`;
    }
    case "don.reserved": {
      const p = n.payload as { title?: string };
      return `« ${p.title ?? "?"} » a été réservé pour toi — contacte le donateur pour récupérer !`;
    }
    default:
      return n.kind;
  }
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const [activityEntries, notifications, latestChangelogDay] = await Promise.all([
    listRecentActivity(20),
    listNotifications(session.member.id, 20),
    getLatestChangelogDay(),
  ]);
  const unreadNotifications = notifications.filter((n) => !n.readAt);
  const readNotifications = notifications.filter((n) => n.readAt);
  const recentActivity = activityEntries.slice(0, RECENT_ACTIVITY_SHOWN);
  const olderActivity = activityEntries.slice(RECENT_ACTIVITY_SHOWN);

  return (
    <Container>
      <PageTitle>Salut, {session.user.name}</PageTitle>

      <section className="mt-8">
        <SectionTitle>Sections du club</SectionTitle>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CLUB_SECTIONS.map((section) =>
            section.live && section.href ? (
              <Link key={section.name} href={section.href}>
                <Card className="h-full p-5 transition-colors hover:border-primary">
                  <p className="font-display font-bold text-ink">{section.name}</p>
                  <p className="mt-1 text-sm text-muted">{section.description}</p>
                </Card>
              </Link>
            ) : (
              <Card key={section.name} className="h-full border-dashed p-5 opacity-60">
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-ink">{section.name}</p>
                  <span className="rounded-full border border-line-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
                    À venir
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{section.description}</p>
              </Card>
            ),
          )}
        </div>
      </section>

      {latestChangelogDay && (
        <section className="mt-10">
          <SectionTitle>Nouveautés</SectionTitle>
          <Card className="mt-3 p-5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              {formatFrench(latestChangelogDay.date as CalendarDate)}
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
              {latestChangelogDay.entries.map((entry) => (
                <li key={entry} className="flex gap-2">
                  <span className="text-primary">•</span>
                  {entry}
                </li>
              ))}
            </ul>
          </Card>
          <Link
            href="/nouveautes"
            className="inline-block py-2.5 text-sm font-medium text-muted hover:text-ink"
          >
            Voir les anciennes mises à jour →
          </Link>
        </section>
      )}

      {/* What needs you comes first: unread notifications, with a way to clear them. Already-read ones fold away. */}
      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>Notifications</SectionTitle>
          {unreadNotifications.length > 0 && (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="-my-2.5 py-2.5 text-xs font-semibold text-primary hover:underline">
                Tout marquer comme lu
              </button>
            </form>
          )}
        </div>
        {unreadNotifications.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Rien de nouveau.</p>
        ) : (
          <Card className="mt-3 divide-y divide-line-soft">
            {unreadNotifications.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </Card>
        )}
        {readNotifications.length > 0 && (
          <FoldedList label={`Déjà lues (${readNotifications.length})`}>
            {readNotifications.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </FoldedList>
        )}
      </section>

      {/* The latest few stay visible so the club feels alive; the rest is one tap away. */}
      <section className="mt-10">
        <SectionTitle>Activité du club</SectionTitle>
        {activityEntries.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Rien pour l&apos;instant.</p>
        ) : (
          <>
            <Card className="mt-3 divide-y divide-line-soft">
              {recentActivity.map((a) => (
                <ActivityRow key={a.id} entry={a} />
              ))}
            </Card>
            {olderActivity.length > 0 && (
              <FoldedList label={`Voir les ${olderActivity.length} autres`}>
                {olderActivity.map((a) => (
                  <ActivityRow key={a.id} entry={a} />
                ))}
              </FoldedList>
            )}
          </>
        )}
      </section>
    </Container>
  );
}

function NotificationRow({ notification: n }: { notification: Notification }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 text-sm">
      {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
      <div className={n.readAt ? "pl-5" : ""}>
        <p className={n.readAt ? "text-muted" : "text-ink"}>{describeNotification(n)}</p>
        <p className="mt-0.5 text-xs text-muted">
          <RelativeTime date={n.createdAt} />
        </p>
      </div>
    </div>
  );
}

function ActivityRow({ entry: a }: { entry: ActivityEntry }) {
  return (
    <div className="px-4 py-3 text-sm">
      <p className="text-ink">{describeActivity(a)}</p>
      <p className="mt-0.5 text-xs text-muted">
        <RelativeTime date={a.createdAt} />
      </p>
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
