"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select, Textarea } from "@/core/ui/components/Field";
import { updateItemAction, type UpdateItemFormState } from "./actions";

const initialState: UpdateItemFormState = { status: "idle" };

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line-soft pt-6 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

export interface EditableItem {
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  model: string | null;
  productUrl: string | null;
  priceCents: number | null;
  replacementValueCents: number | null;
  condition: string;
  accessories: string | null;
  consumables: string | null;
  safetyNotes: string | null;
  pickupLocation: string | null;
  pickupNotes: string | null;
  autoApprove: boolean;
  maxLoanDays: number | null;
  bufferDays: number;
}

/** Same field set as NewItemForm, pre-filled — no OG-fetch helper or photo field, both create-time-only concerns (photos live in PhotoGallery). */
export function EditItemForm({
  itemId,
  itemSlug,
  item,
}: {
  itemId: string;
  itemSlug: string;
  item: EditableItem;
}) {
  const action = updateItemAction.bind(null, itemId, itemSlug);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Fieldset legend="Identité">
        <FormField label="Nom *" htmlFor="name">
          <Input id="name" name="name" defaultValue={item.name} required />
        </FormField>
        <FormField label="Section *" htmlFor="category">
          <Select id="category" name="category" required defaultValue={item.category}>
            <option value="bricolage">Bricolage</option>
            <option value="jardinage">Jardinage</option>
            <option value="menage">Ménage</option>
            <option value="festif">Festif</option>
            <option value="jeux">Jeux de société</option>
            <option value="autre">Autre</option>
          </Select>
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Textarea id="description" name="description" rows={3} defaultValue={item.description ?? ""} />
        </FormField>
      </Fieldset>

      <Fieldset legend="Détails">
        <FormField label="Marque" htmlFor="brand">
          <Input id="brand" name="brand" defaultValue={item.brand ?? ""} />
        </FormField>
        <FormField label="Modèle" htmlFor="model">
          <Input id="model" name="model" defaultValue={item.model ?? ""} />
        </FormField>
        <FormField label="Lien vers le produit" htmlFor="productUrl">
          <Input id="productUrl" name="productUrl" type="url" defaultValue={item.productUrl ?? ""} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Prix (€)" htmlFor="price">
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              defaultValue={item.priceCents !== null ? (item.priceCents / 100).toFixed(2) : ""}
            />
          </FormField>
          <FormField label="Valeur de remplacement (€)" htmlFor="replacementValue">
            <Input
              id="replacementValue"
              name="replacementValue"
              inputMode="decimal"
              defaultValue={
                item.replacementValueCents !== null ? (item.replacementValueCents / 100).toFixed(2) : ""
              }
            />
          </FormField>
        </div>
        <FormField label="État *" htmlFor="condition">
          <Select id="condition" name="condition" required defaultValue={item.condition}>
            <option value="neuf">Neuf</option>
            <option value="bon">Bon</option>
            <option value="usage">Usagé</option>
            <option value="fragile">Fragile</option>
          </Select>
        </FormField>
        <FormField label="Accessoires fournis" htmlFor="accessories">
          <Input id="accessories" name="accessories" defaultValue={item.accessories ?? ""} />
        </FormField>
        <FormField label="Consommables à prévoir" htmlFor="consumables">
          <Input id="consumables" name="consumables" defaultValue={item.consumables ?? ""} />
        </FormField>
        <FormField label="Consignes de sécurité" htmlFor="safetyNotes">
          <Input id="safetyNotes" name="safetyNotes" defaultValue={item.safetyNotes ?? ""} />
        </FormField>
      </Fieldset>

      <Fieldset legend="Récupération et prêt">
        <FormField label="Lieu de récupération" htmlFor="pickupLocation">
          <Input id="pickupLocation" name="pickupLocation" defaultValue={item.pickupLocation ?? ""} />
        </FormField>
        <FormField label="Modalités de récupération" htmlFor="pickupNotes">
          <Input id="pickupNotes" name="pickupNotes" defaultValue={item.pickupNotes ?? ""} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Durée de prêt max (jours)" htmlFor="maxLoanDays">
            <Input
              id="maxLoanDays"
              name="maxLoanDays"
              type="number"
              min={1}
              defaultValue={item.maxLoanDays ?? ""}
            />
          </FormField>
          <FormField label="Jours tampon entre deux prêts" htmlFor="bufferDays">
            <Input
              id="bufferDays"
              name="bufferDays"
              type="number"
              min={0}
              defaultValue={item.bufferDays}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="autoApprove"
            defaultChecked={item.autoApprove}
            className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
          />
          Validation automatique des demandes
        </label>
      </Fieldset>

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
