import { getSession } from "@/core/auth/session";
import { listRecentActivity } from "@/core/activity";
import { listNotifications } from "@/core/notifications";
import type { ActivityEntry, Notification } from "@/core/db/schema";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { categoryLabel } from "@/core/ui/categories";

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
