"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select, Textarea } from "@/core/ui/components/Field";
import { createItemAction, fetchProductMetadataAction, type CreateItemFormState } from "./actions";
import { centsForInput } from "@/core/money";
import { PhotoInput } from "@/core/ui/components/PhotoInput";

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
        priceRef.current.value = centsForInput(metadata.priceCents);
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
      <Fieldset legend="L'essentiel">
        <FormField label="Lien vers le produit (si tu l'as, on remplit le nom et le prix pour toi)" htmlFor="productUrl">
          <div className="flex gap-2">
            <Input id="productUrl" name="productUrl" type="url" ref={productUrlRef} placeholder="https://…" />
            <Button type="button" variant="ghost" disabled={fetchingOg} onClick={handleFetchMetadata} className="shrink-0 whitespace-nowrap">
              {fetchingOg ? "Recherche…" : "Remplir"}
            </Button>
          </div>
          {ogError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{ogError}</p>}
          {ogImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- OG preview from an arbitrary external URL
            <img src={ogImageUrl} alt="" className="mt-2 h-24 w-24 rounded-md object-cover" />
          )}
        </FormField>
        <FormField label="Nom *" htmlFor="name">
          <Input id="name" name="name" ref={nameRef} required placeholder="Perceuse à percussion" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Catégorie *" htmlFor="category">
            <Select id="category" name="category" required defaultValue="bricolage">
              <option value="bricolage">Bricolage</option>
              <option value="jardinage">Jardinage</option>
              <option value="menage">Ménage</option>
              <option value="festif">Festif</option>
              <option value="jeux">Jeux de société</option>
              <option value="autre">Autre</option>
            </Select>
          </FormField>
          <FormField label="État *" htmlFor="condition">
            <Select id="condition" name="condition" required defaultValue="bon">
              <option value="neuf">Neuf</option>
              <option value="bon">Bon</option>
              <option value="usage">Usagé</option>
              <option value="fragile">Fragile</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Photo" htmlFor="photo">
          <PhotoInput id="photo" name="photo" />
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Textarea id="description" name="description" rows={3} placeholder="Ce qu'il faut savoir pour s'en servir…" />
        </FormField>
        <FormField label="Où le récupérer" htmlFor="pickupLocation">
          <Input id="pickupLocation" name="pickupLocation" placeholder="Chez moi, garage côté rue" />
        </FormField>
        <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
          <input type="checkbox" name="autoApprove" className="h-5 w-5 rounded border-line text-primary focus:ring-primary" />
          Accepter les demandes d&apos;emprunt sans avoir à les valider
        </label>
      </Fieldset>

      {/* Everything else is optional: folded, but still sent with the form. */}
      <details className="group rounded-card border border-line-soft">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          Plus de détails (facultatif)
          <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-line-soft p-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Marque" htmlFor="brand">
              <Input id="brand" name="brand" />
            </FormField>
            <FormField label="Modèle" htmlFor="model">
              <Input id="model" name="model" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prix (€)" htmlFor="price">
              <Input id="price" name="price" inputMode="decimal" ref={priceRef} placeholder="0,00" />
            </FormField>
            <FormField label="Valeur de remplacement (€)" htmlFor="replacementValue">
              <Input id="replacementValue" name="replacementValue" inputMode="decimal" placeholder="0,00" />
            </FormField>
          </div>
          <FormField label="Accessoires fournis" htmlFor="accessories">
            <Input id="accessories" name="accessories" />
          </FormField>
          <FormField label="Consommables à prévoir" htmlFor="consumables">
            <Input id="consumables" name="consumables" />
          </FormField>
          <FormField label="Consignes de sécurité" htmlFor="safetyNotes">
            <Input id="safetyNotes" name="safetyNotes" />
          </FormField>
          <FormField label="Modalités de récupération" htmlFor="pickupNotes">
            <Input id="pickupNotes" name="pickupNotes" placeholder="Me prévenir la veille" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Durée de prêt max (jours)" htmlFor="maxLoanDays">
              <Input id="maxLoanDays" name="maxLoanDays" type="number" min={1} />
            </FormField>
            <FormField label="Jours de pause entre deux prêts" htmlFor="bufferDays">
              <Input id="bufferDays" name="bufferDays" type="number" min={0} defaultValue={0} />
            </FormField>
          </div>
        </div>
      </details>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Création..." : "Ajouter au catalogue"}
      </Button>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
