import { getSession } from "@/core/auth/session";
import { listOpenWantedPosts } from "@/modules/pretotheque/data/wantedPosts";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewWantedPostForm } from "./NewWantedPostForm";
import { WantedPostCard } from "./WantedPostCard";

export default async function RecherchesPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const posts = await listOpenWantedPosts();

  return (
    <Container>
      <PageTitle>Recherches</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Tu cherches un objet que personne n&apos;a encore mis au catalogue ? Poste une
        recherche — si plusieurs membres sont intéressés, ça vaut peut-être le coup de
        l&apos;acheter ensemble.
      </p>

      <section className="mt-8">
        <SectionTitle>Publier une recherche</SectionTitle>
        <Card className="mt-3 p-5">
          <NewWantedPostForm />
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>En cours</SectionTitle>
        {posts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Rien pour l&apos;instant.</p>
        ) : (
          <Card className="mt-3 divide-y divide-line-soft">
            {posts.map((post) => (
              <WantedPostCard
                key={post.id}
                id={post.id}
                title={post.title}
                description={post.description}
                neededBy={post.neededBy}
                requesterName={post.requesterName}
                interestCount={post.interestCount}
                isInterested={post.interestedMemberIds.includes(session.member.id)}
                isRequester={post.requesterId === session.member.id}
                groupBuyTriggered={post.groupBuyTriggeredAt !== null}
              />
            ))}
          </Card>
        )}
      </section>
    </Container>
  );
}
