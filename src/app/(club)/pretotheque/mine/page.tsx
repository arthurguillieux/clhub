import Link from "next/link";
import { getSession } from "@/core/auth/session";
import { listItems } from "@/modules/pretotheque/data/items";
import {
  listBookingsByBorrower,
  listPendingRequestsForOwner,
} from "@/modules/pretotheque/data/bookings";
import { Container } from "@/core/ui/components/Container";
import { PageTitle, SectionTitle } from "@/core/ui/components/Heading";
import { Card } from "@/core/ui/components/Card";
import { Badge } from "@/core/ui/components/Badge";
import { formatFrench, type CalendarDate } from "@/core/date";
import {
  approveRequest,
  cancelMyBooking,
  confirmPickup,
  confirmReturn,
  rejectRequest,
} from "./actions";

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Confirmé",
  active: "En cours",
  returned: "Rendu",
  rejected: "Refusé",
  cancelled: "Annulé",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  unavailable: "Indisponible",
  broken: "En panne",
  retired: "Retiré",
};

function ActionButton({
  action,
  bookingId,
  label,
  variant = "ghost",
}: {
  action: (bookingId: string) => Promise<void>;
  bookingId: string;
  label: string;
  variant?: "accent" | "ghost";
}) {
  const bound = action.bind(null, bookingId);
  const style =
    variant === "accent"
      ? "bg-accent text-accent-ink hover:opacity-90"
      : "border border-line text-ink hover:bg-surface";
  return (
    <form action={bound}>
      <button type="submit" className={`rounded-md px-3 py-1.5 text-xs font-semibold ${style}`}>
        {label}
      </button>
    </form>
  );
}

export default async function MyPretothequePage() {
  const session = await getSession();
  if (!session) return null; // guarded by (club)/layout.tsx

  const [myItems, myBookings, pendingRequests] = await Promise.all([
    listItems({ ownerId: session.member.id }),
    listBookingsByBorrower(session.member.id),
    listPendingRequestsForOwner(session.member.id),
  ]);

  return (
    <Container size="lg">
      <PageTitle>Mon activité</PageTitle>

      <section className="mt-10">
        <SectionTitle>
          À valider {pendingRequests.length > 0 && <Badge className="ml-2">{pendingRequests.length}</Badge>}
        </SectionTitle>
        {pendingRequests.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Rien à valider pour l&apos;instant.</p>
        ) : (
          <Card className="mt-3 divide-y divide-line-soft">
            {pendingRequests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/pretotheque/${r.itemSlug}`} className="text-sm font-semibold text-ink hover:underline">
                    {r.itemName}
                  </Link>
                  <p className="text-xs text-muted">
                    {r.borrowerName} — du {formatFrench(r.startDate as CalendarDate)} au{" "}
                    {formatFrench(r.endDate as CalendarDate)}
                  </p>
                  {r.message && <p className="mt-1 text-xs text-ink italic">« {r.message} »</p>}
                </div>
                <div className="flex gap-2">
                  <ActionButton action={approveRequest} bookingId={r.id} label="Accepter" variant="accent" />
                  <ActionButton action={rejectRequest} bookingId={r.id} label="Refuser" />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Mes emprunts</SectionTitle>
        {myBookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Tu n&apos;as encore rien emprunté.</p>
        ) : (
          <Card className="mt-3 divide-y divide-line-soft">
            {myBookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/pretotheque/${b.itemSlug}`} className="text-sm font-semibold text-ink hover:underline">
                    {b.itemName}
                  </Link>
                  <p className="text-xs text-muted">
                    Du {formatFrench(b.startDate as CalendarDate)} au{" "}
                    {formatFrench(b.endDate as CalendarDate)} —{" "}
                    {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  {b.status === "approved" && (
                    <ActionButton action={confirmPickup} bookingId={b.id} label="J'ai récupéré" variant="accent" />
                  )}
                  {b.status === "active" && (
                    <ActionButton action={confirmReturn} bookingId={b.id} label="J'ai rendu" variant="accent" />
                  )}
                  {(b.status === "pending" || b.status === "approved") && (
                    <ActionButton action={cancelMyBooking} bookingId={b.id} label="Annuler" />
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Mes objets</SectionTitle>
        {myItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Tu n&apos;as encore rien ajouté au catalogue —{" "}
            <Link href="/pretotheque/new" className="text-primary underline underline-offset-2">
              ajoute un objet
            </Link>
            .
          </p>
        ) : (
          <Card className="mt-3 divide-y divide-line-soft">
            {myItems.map((it) => (
              <Link
                key={it.id}
                href={`/pretotheque/${it.slug}`}
                className="flex items-center justify-between p-4 text-sm hover:bg-surface"
              >
                <span className="font-medium text-ink">{it.name}</span>
                <span className="text-xs text-muted">
                  {ITEM_STATUS_LABELS[it.status] ?? it.status}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </Container>
  );
}
