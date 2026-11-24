import { getSession } from "@/core/auth/session";
import { getOrCreateCalendarToken } from "@/modules/pretotheque/data/icalFeed";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { MemberCard } from "@/core/ui/components/MemberCard";
import { Card } from "@/core/ui/components/Card";
import { computeGaugeDays } from "@/core/achievements/stats";
import { gaugePosition } from "@/core/achievements/gauge";
import { listCatalogForMember, listUnlockedBadges, syncMemberAchievements } from "@/core/achievements/engine";
import { uploadAvatar } from "./actions";
import { ProfileForm } from "./ProfileForm";
import { CalendarFeedUrl } from "./CalendarFeedUrl";
import { PersonalCalendarForm } from "./PersonalCalendarForm";
import { NotificationPrefsForm } from "./NotificationPrefsForm";
import { DietaryPrefsForm } from "./DietaryPrefsForm";
import { PhotoInput } from "@/core/ui/components/PhotoInput";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Réglages" };

/** Four short tabs instead of one long page; each is a link (`?onglet=`), so the agenda can point straight at « Calendriers ». */
const TABS = [
  { id: "profil", label: "Profil" },
  { id: "notifications", label: "Notifications" },
  { id: "calendriers", label: "Calendriers" },
  { id: "ecussons", label: "Écussons" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet } = await searchParams;
  const tab: TabId = TABS.find((t) => t.id === onglet)?.id ?? "profil";
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // Syncing on every page view (rather than only via the nightly cron) keeps
  // a freshly-earned badge from feeling delayed. calendarToken doesn't
  // depend on achievement state, so it runs alongside the sync rather than
  // after it.
  const [calendarToken] = await Promise.all([
    getOrCreateCalendarToken(session.member.id),
    syncMemberAchievements(session.member.id),
  ]);
  const calendarUrl = `${appUrl}/api/ical/${calendarToken}`;

  const [gaugeDays, badges, catalog] = await Promise.all([
    computeGaugeDays(session.member.id),
    listUnlockedBadges(session.member.id),
    listCatalogForMember(session.member.id),
  ]);
  const hasActivity = gaugeDays.lentDays > 0 || gaugeDays.borrowedDays > 0;

  return (
    <Container>
      <PageTitle>Réglages</PageTitle>

      <nav aria-label="Rubriques des réglages" className="mt-5 flex gap-2 overflow-x-auto pb-1 text-sm font-medium">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "profil" ? "/settings" : `/settings?onglet=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-full px-3.5 whitespace-nowrap ${tab === t.id ? "bg-ink text-ground" : "border border-line text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "profil" && (
        <>
          <div className="mt-6 max-w-md">
            <MemberCard
              name={session.user.name}
              memberNumber={session.member.memberNumber}
              image={session.user.image}
              bio={session.member.bio}
              joinedAt={session.member.joinedAt}
              gauge={hasActivity ? gaugePosition(gaugeDays.lentDays, gaugeDays.borrowedDays) : undefined}
              badges={badges}
            />
          </div>

          <section className="mt-8">
            <SectionTitle>Avatar</SectionTitle>
            <Card className="mt-3 p-5">
              <form action={uploadAvatar} className="flex flex-wrap items-center gap-3">
                <PhotoInput name="avatar" required />
                <button type="submit" className="min-h-11 rounded-full border border-line bg-transparent px-4 text-sm font-semibold text-ink hover:bg-surface">
                  Mettre cette photo
                </button>
              </form>
            </Card>
          </section>

          <section className="mt-8">
            <SectionTitle>Profil</SectionTitle>
            <Card className="mt-3 p-5">
              <ProfileForm
                name={session.user.name}
                bio={session.member.bio}
                phone={session.member.phone}
                householdSize={session.member.householdSize}
              />
            </Card>
          </section>

          <section className="mt-8">
            <SectionTitle>Régime alimentaire</SectionTitle>
            <Card className="mt-3 p-5">
              <DietaryPrefsForm dietaryTags={session.member.dietaryTags} dietaryNotes={session.member.dietaryNotes} />
            </Card>
          </section>
        </>
      )}

      {tab === "notifications" && (
        <section className="mt-8">
          <SectionTitle>Notifications par mail</SectionTitle>
          <Card className="mt-3 p-5">
            <NotificationPrefsForm notifPrefs={session.member.notifPrefs} />
          </Card>
        </section>
      )}

      {tab === "calendriers" && (
        <>
          <section className="mt-8">
            <SectionTitle>Mon calendrier</SectionTitle>
            <Card className="mt-3 p-5">
              <p className="text-sm text-muted">
                Abonne-toi à ce lien depuis ton agenda (Google Calendar, Apple Calendar…) pour voir tes emprunts et tes prêts confirmés.
              </p>
              <div className="mt-3">
                <CalendarFeedUrl url={calendarUrl} />
              </div>
            </Card>
          </section>

          <section className="mt-8">
            <SectionTitle>Mon agenda personnel</SectionTitle>
            <Card className="mt-3 p-5">
              <PersonalCalendarForm currentUrl={session.member.personalCalendarUrl} />
            </Card>
          </section>
        </>
      )}

      {tab === "ecussons" && (
        <section className="mt-8">
          <SectionTitle>Écussons</SectionTitle>
          <Card className="mt-3 p-5">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {catalog.map((a) => (
                <li
                  key={a.key}
                  className={`flex items-start gap-3 rounded-md border p-3 ${a.unlocked ? "border-line bg-surface" : "border-line-soft opacity-50"}`}
                >
                  <span className="text-2xl">{a.unlocked ? a.icon : a.secret ? "❓" : a.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{a.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{a.description ?? a.hint ?? "Écusson secret."}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </Container>
  );
}
