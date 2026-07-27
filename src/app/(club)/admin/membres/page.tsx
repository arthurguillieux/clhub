import { requireAdmin } from "@/core/auth/admin";
import { getMemberDeletionImpact, listAllMembersForAdmin } from "@/modules/admin/data/members";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { InviteByEmailForm } from "./InviteByEmailForm";
import { RoleToggle } from "./RoleToggle";
import { DeleteMemberButton } from "./DeleteMemberButton";

export default async function AdminMembresPage() {
  const session = await requireAdmin();

  const members = await listAllMembersForAdmin();
  const impacts = await Promise.all(members.map((m) => getMemberDeletionImpact(m.id)));

  return (
    <Container>
      <PageTitle>Membres</PageTitle>

      <section className="mt-6">
        <SectionTitle>Inviter par mail</SectionTitle>
        <Card className="mt-3 p-4">
          <InviteByEmailForm />
        </Card>
      </section>

      <section className="mt-8">
        <SectionTitle>Tous les membres</SectionTitle>
        <div className="mt-3 flex flex-col gap-3">
          {members.map((m, i) => (
            <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar thumbnail
                  <img src={m.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-sm font-extrabold text-accent-ink">
                    {(m.name || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="font-display text-base font-extrabold text-ink">
                    {m.name || "Membre"}
                  </p>
                  <p className="text-xs text-muted">
                    {m.email} · n°{m.memberNumber}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <RoleToggle memberId={m.id} role={m.role} />
                {m.id !== session.member.id && (
                  <DeleteMemberButton memberId={m.id} name={m.name || "ce membre"} impact={impacts[i]!} />
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </Container>
  );
}
