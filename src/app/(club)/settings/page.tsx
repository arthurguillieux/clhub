import { getSession } from "@/core/auth/session";
import { getOrCreateCalendarToken } from "@/modules/pretotheque/data/icalFeed";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { MemberCard } from "@/core/ui/components/MemberCard";
import { Card } from "@/core/ui/components/Card";
import { uploadAvatar } from "./actions";
import { ProfileForm } from "./ProfileForm";
import { CalendarFeedUrl } from "./CalendarFeedUrl";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const calendarToken = await getOrCreateCalendarToken(session.member.id);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const calendarUrl = `${appUrl}/api/ical/${calendarToken}`;

  return (
    <Container>
      <PageTitle>Réglages</PageTitle>

      <div className="mt-6">
        <MemberCard
          name={session.user.name}
          memberNumber={session.member.memberNumber}
          image={session.user.image}
          bio={session.member.bio}
          joinedAt={session.member.joinedAt}
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
              className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-ink"
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
          <ProfileForm bio={session.member.bio} phone={session.member.phone} />
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
    </Container>
  );
}
