"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select, Textarea } from "@/core/ui/components/Field";
import { createListingAction, type CreateListingState } from "../actions";
import type { DonCategory } from "@/core/db/schema";

const initialState: CreateListingState = { status: "idle" };

export function NewListingForm({ categories }: { categories: DonCategory[] }) {
  const [state, formAction, pending] = useActionState(createListingAction, initialState);
  const [isFree, setIsFree] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Quoi *" htmlFor="title">
        <Input id="title" name="title" placeholder="Vélo enfant 16 pouces" required />
      </FormField>

      <FormField label="Catégorie *" htmlFor="categoryId">
        <Select id="categoryId" name="categoryId" required defaultValue="">
          <option value="" disabled>
            Choisir...
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Description (optionnel)" htmlFor="description">
        <Textarea id="description" name="description" rows={4} placeholder="État, dimensions, pourquoi tu t'en sépares..." />
      </FormField>

      <FormField label="Photo (optionnel)" htmlFor="photo">
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
              <Input id="priceText" name="priceText" placeholder="10€, échange contre..." />
            </FormField>
          </div>
        )}
      </div>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Publier l'annonce"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
