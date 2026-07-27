import { requireAdmin } from "@/core/auth/admin";
import { listAllItemsForAdmin } from "@/modules/admin/data/items";
import { listAllMembersForAdmin } from "@/modules/admin/data/members";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { categoryLabel } from "@/core/ui/categories";
import { ReassignItemForm } from "./ReassignItemForm";
import { DeleteItemButton } from "./DeleteItemButton";

export default async function AdminObjetsPage() {
  await requireAdmin();

  const [items, members] = await Promise.all([listAllItemsForAdmin(), listAllMembersForAdmin()]);
  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }));

  return (
    <Container size="lg">
      <PageTitle>Objets</PageTitle>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Rien dans la prêtothèque pour l&apos;instant.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {items.map((it) => (
            <Card key={it.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-display text-base font-extrabold text-ink">{it.name}</p>
                <p className="text-xs text-muted">
                  {categoryLabel(it.category)} · proposé par {it.ownerName || "Membre"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ReassignItemForm itemId={it.id} currentOwnerId={it.ownerId} members={memberOptions} />
                <DeleteItemButton itemId={it.id} name={it.name} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
