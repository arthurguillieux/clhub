import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { getRecipeById } from "@/modules/recipes/data/recipes";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { EditRecipeForm } from "../EditRecipeForm";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  const isOwner = session.member.id === recipe.createdById;
  const isAdmin = await isAdminModeActive();
  if (!isOwner && !isAdmin) {
    redirect(`/recettes/${id}`);
  }

  return (
    <Container size="sm">
      <Link href={`/recettes/${id}`} className="text-sm font-medium text-muted hover:text-ink">
        ← {recipe.title}
      </Link>
      <div className="mt-2">
        <PageTitle>Modifier {recipe.title}</PageTitle>
      </div>
      <Card className="mt-6 p-6">
        <EditRecipeForm recipeId={recipe.id} recipe={recipe} />
      </Card>
    </Container>
  );
}
