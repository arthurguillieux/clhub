import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { getMemberProfile } from "@/modules/members/data/members";
import { computeGaugeDays } from "@/core/achievements/stats";
import { gaugePosition } from "@/core/achievements/gauge";
import { listUnlockedBadges } from "@/core/achievements/engine";
import { Container } from "@/core/ui/components/Container";
import { SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { MemberCard } from "@/core/ui/components/MemberCard";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const profile = await getMemberProfile(id);
  if (!profile) notFound();

  const [gaugeDays, badges] = await Promise.all([
    computeGaugeDays(profile.id),
    listUnlockedBadges(profile.id),
  ]);
  const hasActivity = gaugeDays.lentDays > 0 || gaugeDays.borrowedDays > 0;

  return (
    <Container>
      <Link href="/membres" className="text-sm font-medium text-muted hover:text-ink">
        ← Membres
      </Link>

      <div className="mt-4 max-w-md">
        <MemberCard
          name={profile.name || "Membre"}
          memberNumber={profile.memberNumber}
          image={profile.image}
          bio={profile.bio}
          joinedAt={profile.joinedAt}
          gauge={hasActivity ? gaugePosition(gaugeDays.lentDays, gaugeDays.borrowedDays) : undefined}
          badges={badges}
        />
      </div>

      <section className="mt-8">
        <SectionTitle>Succès</SectionTitle>
        <Card className="mt-3 p-5">
          {badges.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {badges.map((b) => (
                <li
                  key={b.key}
                  className="flex items-start gap-3 rounded-md border border-line bg-surface p-3"
                >
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{b.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{b.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucun écusson débloqué pour l&apos;instant.</p>
          )}
        </Card>
      </section>
    </Container>
  );
}
