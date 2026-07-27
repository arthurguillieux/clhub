import Link from "next/link";
import { requireAdmin } from "@/core/auth/admin";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <Container>
      <PageTitle>Admin</PageTitle>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/admin/membres">
          <Card className="h-full p-5 transition-colors hover:border-primary">
            <h2 className="font-display text-base font-extrabold text-ink">Membres</h2>
            <p className="mt-1 text-sm text-muted">
              Inviter par mail, changer un rôle, supprimer un compte.
            </p>
          </Card>
        </Link>
        <Link href="/admin/objets">
          <Card className="h-full p-5 transition-colors hover:border-primary">
            <h2 className="font-display text-base font-extrabold text-ink">Objets</h2>
            <p className="mt-1 text-sm text-muted">
              Tous les objets du club, tous propriétaires confondus — réattribuer, supprimer.
            </p>
          </Card>
        </Link>
      </div>
    </Container>
  );
}
