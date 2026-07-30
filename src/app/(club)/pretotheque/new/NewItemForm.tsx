"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select, Textarea } from "@/core/ui/components/Field";
import { createItemAction, fetchProductMetadataAction, type CreateItemFormState } from "./actions";

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
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const productUrlRef = useRef<HTMLInputElement>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [fetchingOg, setFetchingOg] = useState(false);
  const [ogError, setOgError] = useState<string | null>(null);

  async function handleFetchMetadata() {
    const url = productUrlRef.current?.value.trim();
    if (!url) return;

    setFetchingOg(true);
    setOgError(null);
    try {
      const metadata = await fetchProductMetadataAction(url);
      if (!metadata) {
        setOgError("Impossible de récupérer les informations pour ce lien.");
        return;
      }
      if (metadata.title && nameRef.current && !nameRef.current.value) {
        nameRef.current.value = metadata.title;
      }
      if (metadata.priceCents !== null && priceRef.current && !priceRef.current.value) {
        priceRef.current.value = (metadata.priceCents / 100).toFixed(2);
      }
      if (metadata.image) {
        setOgImageUrl(metadata.image);
      }
    } finally {
      setFetchingOg(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="ogImageUrl" value={ogImageUrl ?? ""} />
      <Fieldset legend="Identité">
        <FormField label="Nom *" htmlFor="name">
          <Input id="name" name="name" ref={nameRef} required />
        </FormField>
        <FormField label="Section *" htmlFor="category">
          <Select id="category" name="category" required defaultValue="bricolage">
            <option value="bricolage">Bricolage</option>
            <option value="jardinage">Jardinage</option>
            <option value="menage">Ménage</option>
            <option value="festif">Festif</option>
            <option value="jeux">Jeux de société</option>
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
            className="text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-ink file:transition-colors hover:file:bg-primary/90"
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
          <div className="flex gap-2">
            <Input id="productUrl" name="productUrl" type="url" ref={productUrlRef} />
            <Button
              type="button"
              variant="ghost"
              disabled={fetchingOg}
              onClick={handleFetchMetadata}
              className="shrink-0 whitespace-nowrap"
            >
              {fetchingOg ? "Recherche..." : "Récupérer les infos"}
            </Button>
          </div>
          {ogError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{ogError}</p>}
          {ogImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- OG preview from an arbitrary external URL
            <img src={ogImageUrl} alt="" className="mt-2 h-24 w-24 rounded-md object-cover" />
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Prix (€)" htmlFor="price">
            <Input id="price" name="price" inputMode="decimal" ref={priceRef} />
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
