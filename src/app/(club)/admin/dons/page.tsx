import { requireAdmin } from "@/core/auth/admin";
import { listDonCategories } from "@/modules/dons/data/categories";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { NewCategoryForm } from "./NewCategoryForm";

export default async function AdminDonsPage() {
  await requireAdmin();

  const categories = await listDonCategories();

  return (
    <Container size="sm">
      <PageTitle>Catégories des Cabanes à dons</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Ajoute une catégorie ici si celles qui existent déjà ne suffisent pas — pas besoin de
        redéploiement.
      </p>

      <Card className="mt-6 p-5">
        <NewCategoryForm />
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-sm font-extrabold tracking-wide text-ink uppercase">
          Catégories existantes
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="rounded-full border border-line-soft bg-surface px-2.5 py-1 text-xs text-ink"
            >
              {c.name}
            </li>
          ))}
        </ul>
      </Card>
    </Container>
  );
}
