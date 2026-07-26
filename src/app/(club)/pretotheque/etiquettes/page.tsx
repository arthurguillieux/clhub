import { getSession } from "@/core/auth/session";
import { listItems } from "@/modules/pretotheque/data/items";
import { itemQrSvg } from "@/core/qrcode";
import { Container } from "@/core/ui/components/Container";
import { PageTitle } from "@/core/ui/components/Heading";

export default async function EtiquettesPage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const items = await listItems();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const labels = await Promise.all(
    items.map(async (it) => ({
      id: it.id,
      name: it.name,
      ownerName: it.ownerName,
      svg: await itemQrSvg(`${appUrl}/pretotheque/${it.slug}`),
    })),
  );

  return (
    <Container size="lg">
      <div className="print:hidden">
        <PageTitle>Étiquettes</PageTitle>
        <p className="mt-2 text-sm text-muted">
          Une étiquette par objet du catalogue, prête à découper et coller. Le raccourci
          clavier d&apos;impression habituel (Ctrl/Cmd+P) fonctionne directement sur cette
          page.
        </p>
      </div>

      {labels.length === 0 ? (
        <p className="mt-6 text-sm text-muted print:hidden">Aucun objet dans le catalogue.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-3">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex flex-col items-center gap-2 rounded-md border border-line-soft p-4 text-center print:break-inside-avoid print:border-ink/30"
            >
              <div
                className="h-28 w-28 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: label.svg }}
              />
              <p className="font-display text-sm font-bold text-ink">{label.name}</p>
              <p className="text-xs text-muted">{label.ownerName}</p>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
