"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select, Textarea } from "@/core/ui/components/Field";
import { createItemAction, type CreateItemFormState } from "./actions";

const initialState: CreateItemFormState = { status: "idle" };

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

export function NewItemForm() {
  const [state, formAction, pending] = useActionState(createItemAction, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-6">
      <Fieldset legend="Identité">
        <FormField label="Nom *" htmlFor="name">
          <Input id="name" name="name" required />
        </FormField>
        <FormField label="Section *" htmlFor="category">
          <Select id="category" name="category" required defaultValue="bricolage">
            <option value="bricolage">Bricolage</option>
            <option value="jardinage">Jardinage</option>
            <option value="menage">Ménage</option>
            <option value="festif">Festif</option>
            <option value="autre">Autre</option>
          </Select>
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Textarea id="description" name="description" rows={3} />
        </FormField>
        <FormField label="Photo" htmlFor="photo">
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-ink"
          />
        </FormField>
      </Fieldset>

      <Fieldset legend="Détails">
        <FormField label="Marque" htmlFor="brand">
          <Input id="brand" name="brand" />
        </FormField>
        <FormField label="Modèle" htmlFor="model">
          <Input id="model" name="model" />
        </FormField>
        <FormField label="Lien vers le produit" htmlFor="productUrl">
          <Input id="productUrl" name="productUrl" type="url" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Prix (€)" htmlFor="price">
            <Input id="price" name="price" inputMode="decimal" />
          </FormField>
          <FormField label="Valeur de remplacement (€)" htmlFor="replacementValue">
            <Input id="replacementValue" name="replacementValue" inputMode="decimal" />
          </FormField>
        </div>
        <FormField label="État *" htmlFor="condition">
          <Select id="condition" name="condition" required defaultValue="bon">
            <option value="neuf">Neuf</option>
            <option value="bon">Bon</option>
            <option value="usage">Usagé</option>
            <option value="fragile">Fragile</option>
          </Select>
        </FormField>
        <FormField label="Accessoires fournis" htmlFor="accessories">
          <Input id="accessories" name="accessories" />
        </FormField>
        <FormField label="Consommables à prévoir" htmlFor="consumables">
          <Input id="consumables" name="consumables" />
        </FormField>
        <FormField label="Consignes de sécurité" htmlFor="safetyNotes">
          <Input id="safetyNotes" name="safetyNotes" />
        </FormField>
      </Fieldset>

      <Fieldset legend="Récupération et prêt">
        <FormField label="Lieu de récupération" htmlFor="pickupLocation">
          <Input id="pickupLocation" name="pickupLocation" />
        </FormField>
        <FormField label="Modalités de récupération" htmlFor="pickupNotes">
          <Input id="pickupNotes" name="pickupNotes" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Durée de prêt max (jours)" htmlFor="maxLoanDays">
            <Input id="maxLoanDays" name="maxLoanDays" type="number" min={1} />
          </FormField>
          <FormField label="Jours tampon entre deux prêts" htmlFor="bufferDays">
            <Input id="bufferDays" name="bufferDays" type="number" min={0} defaultValue={0} />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="autoApprove"
            className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
          />
          Validation automatique des demandes
        </label>
      </Fieldset>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Création..." : "Ajouter au catalogue"}
      </Button>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
