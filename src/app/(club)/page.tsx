import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listRecentActivity } from "@/core/activity";
import { listNotifications } from "@/core/notifications";
import type { ActivityEntry, Notification } from "@/core/db/schema";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { categoryLabel } from "@/core/ui/categories";
import { formatFrench, type CalendarDate } from "@/core/date";

const SECTIONS = [
  {
    name: "Prêtothèque",
    description: "Le matériel du club, réservable en deux clics.",
    href: "/pretotheque",
    live: true,
  },
  {
    name: "Les menus du club",
    description: "Organiser un repas de groupe — qui vient, qui apporte quoi.",
    href: null,
    live: false,
  },
] as const;

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
    default:
      return n.kind;
  }
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const [activityEntries, notifications] = await Promise.all([
    listRecentActivity(20),
    listNotifications(session.member.id, 20),
  ]);

  return (
    <Container>
      <PageTitle>Salut, {session.user.name}</PageTitle>

      <section className="mt-8">
        <SectionTitle>Sections du club</SectionTitle>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SECTIONS.map((section) =>
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

      <section className="mt-10">
        <SectionTitle>Notifications</SectionTitle>
        {notifications.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Rien pour l&apos;instant.</p>
        ) : (
          <Card className="mt-3 divide-y divide-line-soft">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                <div className={!n.readAt ? "" : "pl-5"}>
                  <p className="text-ink">{describeNotification(n)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {n.createdAt.toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Activité du club</SectionTitle>
        <Card className="mt-3 divide-y divide-line-soft">
          {activityEntries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Rien pour l&apos;instant.</p>
          ) : (
            activityEntries.map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm">
                <p className="text-ink">{describeActivity(a)}</p>
                <p className="mt-0.5 text-xs text-muted">{a.createdAt.toLocaleString("fr-FR")}</p>
              </div>
            ))
          )}
        </Card>
      </section>
    </Container>
  );
}
