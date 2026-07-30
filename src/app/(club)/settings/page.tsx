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

export default async function SettingsPage() {
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

      <section className="mt-10">
        <SectionTitle>Avatar</SectionTitle>
        <Card className="mt-3 p-5">
          <form action={uploadAvatar} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="avatar"
              accept="image/*"
              required
              className="text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-ink file:transition-colors hover:file:bg-primary/90"
            />
            <button
              type="submit"
              className="rounded-md border border-line bg-transparent px-4 py-2 text-sm font-semibold text-ink hover:bg-surface"
            >
              Envoyer
            </button>
          </form>
        </Card>
      </section>

      <section className="mt-10">
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

      <section className="mt-10">
        <SectionTitle>Régime alimentaire</SectionTitle>
        <Card className="mt-3 p-5">
          <DietaryPrefsForm dietaryTags={session.member.dietaryTags} dietaryNotes={session.member.dietaryNotes} />
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>Mon calendrier</SectionTitle>
        <Card className="mt-3 p-5">
          <p className="text-sm text-muted">
            Abonne-toi à ce lien depuis ton agenda (Google Calendar, Apple Calendar...) pour voir
            tes emprunts et tes prêts confirmés.
          </p>
          <div className="mt-3">
            <CalendarFeedUrl url={calendarUrl} />
          </div>
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>Mon agenda personnel</SectionTitle>
        <Card className="mt-3 p-5">
          <PersonalCalendarForm currentUrl={session.member.personalCalendarUrl} />
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>Notifications par mail</SectionTitle>
        <Card className="mt-3 p-5">
          <NotificationPrefsForm notifPrefs={session.member.notifPrefs} />
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>Écussons</SectionTitle>
        <Card className="mt-3 p-5">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {catalog.map((a) => (
              <li
                key={a.key}
                className={`flex items-start gap-3 rounded-md border p-3 ${
                  a.unlocked ? "border-line bg-surface" : "border-line-soft opacity-50"
                }`}
              >
                <span className="text-2xl">{a.unlocked ? a.icon : a.secret ? "❓" : a.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-ink">{a.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.description ?? a.hint ?? "Écusson secret."}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Container>
  );
}
