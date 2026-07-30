"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select, Textarea } from "@/core/ui/components/Field";
import { updateListingAction, type UpdateListingState } from "../actions";
import type { DonCategory } from "@/core/db/schema";

const initialState: UpdateListingState = { status: "idle" };

export interface EditableListing {
  title: string;
  categoryId: string;
  description: string | null;
  priceText: string | null;
  isFree: boolean;
  photoPath: string | null;
}

export function EditListingForm({
  listingId,
  listing,
  categories,
}: {
  listingId: string;
  listing: EditableListing;
  categories: DonCategory[];
}) {
  const action = updateListingAction.bind(null, listingId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [isFree, setIsFree] = useState(listing.isFree);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Quoi *" htmlFor="title">
        <Input id="title" name="title" defaultValue={listing.title} required />
      </FormField>

      <FormField label="Catégorie *" htmlFor="categoryId">
        <Select id="categoryId" name="categoryId" required defaultValue={listing.categoryId}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Description (optionnel)" htmlFor="description">
        <Textarea id="description" name="description" rows={4} defaultValue={listing.description ?? ""} />
      </FormField>

      <FormField label={listing.photoPath ? "Remplacer la photo (optionnel)" : "Photo (optionnel)"} htmlFor="photo">
        {listing.photoPath && (
          // eslint-disable-next-line @next/next/no-img-element -- current photo preview
          <img src={listing.photoPath} alt="" className="mb-2 h-24 w-24 rounded-md object-cover" />
        )}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          className="text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-ink file:transition-colors hover:file:bg-primary/90"
        />
      </FormField>

      <div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isFree"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
          />
          C&apos;est un don (gratuit)
        </label>
        {!isFree && (
          <div className="mt-3">
            <FormField label="Prix" htmlFor="priceText">
              <Input id="priceText" name="priceText" defaultValue={listing.priceText ?? ""} placeholder="10€, échange contre..." />
            </FormField>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} variant="accent" className="self-start">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
        )}
      </div>
    </form>
  );
}
