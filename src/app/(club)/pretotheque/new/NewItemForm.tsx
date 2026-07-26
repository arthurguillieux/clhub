"use client";

import { useActionState } from "react";
import { createItemAction, type CreateItemFormState } from "./actions";

const initialState: CreateItemFormState = { status: "idle" };

const fieldStyle = { padding: "8px", border: "1px solid #ccc", borderRadius: "4px" };

export function NewItemForm() {
  const [state, formAction, pending] = useActionState(createItemAction, initialState);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}
    >
      <label htmlFor="name">Nom *</label>
      <input id="name" name="name" required style={fieldStyle} />

      <label htmlFor="category">Section *</label>
      <select id="category" name="category" required style={fieldStyle} defaultValue="bricolage">
        <option value="bricolage">Bricolage</option>
        <option value="jardinage">Jardinage</option>
        <option value="menage">Ménage</option>
        <option value="festif">Festif</option>
        <option value="autre">Autre</option>
      </select>

      <label htmlFor="description">Description</label>
      <textarea id="description" name="description" rows={3} style={fieldStyle} />

      <label htmlFor="photo">Photo</label>
      <input id="photo" name="photo" type="file" accept="image/*" />

      <label htmlFor="brand">Marque</label>
      <input id="brand" name="brand" style={fieldStyle} />

      <label htmlFor="model">Modèle</label>
      <input id="model" name="model" style={fieldStyle} />

      <label htmlFor="productUrl">Lien vers le produit</label>
      <input id="productUrl" name="productUrl" type="url" style={fieldStyle} />

      <label htmlFor="price">Prix (€)</label>
      <input id="price" name="price" inputMode="decimal" style={fieldStyle} />

      <label htmlFor="replacementValue">Valeur de remplacement (€)</label>
      <input id="replacementValue" name="replacementValue" inputMode="decimal" style={fieldStyle} />

      <label htmlFor="condition">État *</label>
      <select id="condition" name="condition" required style={fieldStyle} defaultValue="bon">
        <option value="neuf">Neuf</option>
        <option value="bon">Bon</option>
        <option value="usage">Usagé</option>
        <option value="fragile">Fragile</option>
      </select>

      <label htmlFor="accessories">Accessoires fournis</label>
      <input id="accessories" name="accessories" style={fieldStyle} />

      <label htmlFor="consumables">Consommables à prévoir</label>
      <input id="consumables" name="consumables" style={fieldStyle} />

      <label htmlFor="safetyNotes">Consignes de sécurité</label>
      <input id="safetyNotes" name="safetyNotes" style={fieldStyle} />

      <label htmlFor="pickupLocation">Lieu de récupération</label>
      <input id="pickupLocation" name="pickupLocation" style={fieldStyle} />

      <label htmlFor="pickupNotes">Modalités de récupération</label>
      <input id="pickupNotes" name="pickupNotes" style={fieldStyle} />

      <label htmlFor="maxLoanDays">Durée de prêt max (jours)</label>
      <input id="maxLoanDays" name="maxLoanDays" type="number" min={1} style={fieldStyle} />

      <label htmlFor="bufferDays">Jours tampon entre deux prêts</label>
      <input
        id="bufferDays"
        name="bufferDays"
        type="number"
        min={0}
        defaultValue={0}
        style={fieldStyle}
      />

      <label>
        <input type="checkbox" name="autoApprove" /> Validation automatique des demandes
      </label>

      <button type="submit" disabled={pending} style={{ padding: "8px 16px" }}>
        {pending ? "Création..." : "Ajouter au catalogue"}
      </button>

      {state.status === "error" && <p style={{ color: "crimson" }}>{state.message}</p>}
    </form>
  );
}
