import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getMemberProfile, getMemberProfileForEdit } from "@/modules/members/data/members";
import { computeGaugeDays } from "@/core/achievements/stats";
import { gaugePosition } from "@/core/achievements/gauge";
import { listUnlockedBadges } from "@/core/achievements/engine";
import { Container } from "@/core/ui/components/Container";
import { SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { MemberCard } from "@/core/ui/components/MemberCard";
import { AdminProfileEditor } from "./AdminProfileEditor";
import { memberLife, statLabel } from "@/core/achievements/club";
import { SectionTile } from "@/core/ui/components/SectionIcon";
import { POLES } from "@/core/ui/sections";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await getMemberProfile(id);
  return { title: d?.name || "Membre" };
}

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

  const isAdmin = await isAdminModeActive();
  const [gaugeDays, badges, editable, life] = await Promise.all([
    computeGaugeDays(profile.id),
    listUnlockedBadges(profile.id),
    isAdmin ? getMemberProfileForEdit(profile.id) : Promise.resolve(null),
    memberLife(profile.id),
  ]);
  const hasActivity = gaugeDays.lentDays > 0 || gaugeDays.borrowedDays > 0;
  // The lender / borrower balance belongs to « Partager », among the rest of the member's club life.
  const gauge = hasActivity ? gaugePosition(gaugeDays.lentDays, gaugeDays.borrowedDays) : null;

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
          badges={badges}
        />
        {isAdmin && editable && (
          <div className="mt-3">
            <AdminProfileEditor
              memberId={editable.id}
              name={editable.name}
              bio={editable.bio}
              phone={editable.phone}
              householdSize={editable.householdSize}
            />
          </div>
        )}
      </div>

      <section className="mt-8">
        <SectionTitle>Au CLHUB</SectionTitle>
        {life.length === 0 ? (
          <Card className="mt-3 p-5">
            <p className="text-sm text-muted">Pas encore d&apos;activité au club : ça viendra !</p>
          </Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {POLES.map((pole) => {
              const p = life.find((x) => x.pole === pole.id);
              if (!p) return null;
              return (
                <Card key={pole.id} className="flex gap-3 p-4">
                  <SectionTile id={pole.id} size={36} />
                  <div className="min-w-0">
                    <p className="font-display font-extrabold text-ink">{pole.name}</p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted">
                      {p.stats.map((x) => (
                        <li key={x.one}>
                          <span className="font-semibold text-ink tabular-nums">{x.n}</span> {statLabel(x)}
                        </li>
                      ))}
                      {pole.id === "partager" && gauge && (
                        <li>
                          {gauge.emoji} {gauge.label}
                        </li>
                      )}
                    </ul>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

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
