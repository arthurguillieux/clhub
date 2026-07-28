import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { getMemberProfile } from "@/modules/members/data/members";
import { computeGaugeDays } from "@/core/achievements/stats";
import { gaugePosition } from "@/core/achievements/gauge";
import { listUnlockedBadges } from "@/core/achievements/engine";
import { Container } from "@/core/ui/components/Container";
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
    </Container>
  );
}
