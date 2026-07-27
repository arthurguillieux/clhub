import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listMembers } from "@/modules/members/data/members";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";

export default async function MembresPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const members = await listMembers();

  return (
    <Container>
      <PageTitle>Membres</PageTitle>
      <Link
        href="/wrapped"
        className="glow-text-primary mt-1 block font-display text-3xl font-extrabold tracking-tight text-primary text-balance hover:opacity-90"
      >
        CLHUB Wrapped
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {members.map((m) => {
          const name = m.name || "Membre";
          return (
            <Link key={m.id} href={`/membres/${m.id}`}>
              <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:border-primary">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar thumbnail
                  <img src={m.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-sm font-extrabold text-accent-ink">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="font-display text-base font-extrabold text-ink">{name}</p>
                  <p className="text-xs text-muted">
                    Membre {m.memberNumber !== null ? `n°${m.memberNumber}` : ""}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
