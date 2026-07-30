import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { listDonCategories } from "@/modules/dons/data/categories";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewListingForm } from "./NewListingForm";

export default async function NewListingPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const [categories, isAdmin] = await Promise.all([listDonCategories(), isAdminModeActive()]);

  return (
    <Container size="sm">
      <PageTitle>Proposer un objet</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Un don, un troc ou une petite vente entre membres — visible de tous dans les Cabanes à
        dons.
      </p>
      {categories.length === 0 && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Aucune catégorie n&apos;existe encore
          {isAdmin ? (
            <>
              {" "}
              —{" "}
              <Link href="/admin/dons" className="underline underline-offset-2">
                ajoutes-en une
              </Link>{" "}
              avant de publier.
            </>
          ) : (
            " — demande à un admin d'en ajouter une avant de publier."
          )}
        </p>
      )}

      <Card className="mt-6 p-6">
        <NewListingForm categories={categories} />
      </Card>
    </Container>
  );
}
