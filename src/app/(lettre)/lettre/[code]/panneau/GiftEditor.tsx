"use client";

import { useId, useState } from "react";
import { joinNames, siteOf } from "@/modules/lettre/domain/letter";
import { de } from "@/modules/santa/words";
import type { GiftView } from "@/modules/lettre/views";
import { letterPreviewAction } from "../../actions";
import { ImagePicker } from "../../ImagePicker";

type Photo = { kind: "keep" } | { kind: "remove" } | { kind: "data"; dataUrl: string } | { kind: "stored"; id: string; url: string };

export interface GiftPayload {
  title: string;
  url: string;
  price: string;
  note: string;
  secondHand: boolean;
  favorite: boolean;
  copies: number | null;
  pot: boolean;
  photo: { kind: "keep" } | { kind: "remove" } | { kind: "data"; dataUrl: string } | { kind: "stored"; id: string };
}

const centsText = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ","));

/**
 * A gift's fiche, new or to change. A shop's link can fill it in: name, price and picture, whatever
 * is already typed stays. `onSave` answers with an error, or null once saved.
 */
export function GiftEditor({
  code,
  childName,
  gift,
  busy,
  onSave,
  onClose,
}: {
  code: string;
  childName: string;
  gift: GiftView | null;
  busy: boolean;
  onSave: (payload: GiftPayload) => Promise<string | null>;
  onClose: () => void;
}) {
  const ids = useId();
  const [title, setTitle] = useState(gift?.title ?? "");
  const [url, setUrl] = useState(gift?.url ?? "");
  const [price, setPrice] = useState(gift?.priceCents != null ? centsText(gift.priceCents) : "");
  const [note, setNote] = useState(gift?.note ?? "");
  const [secondHand, setSecondHand] = useState(gift?.secondHand ?? false);
  const [favorite, setFavorite] = useState(gift?.favorite ?? false);
  const [mode, setMode] = useState<"one" | "several" | "pot">(gift ? (gift.pot ? "pot" : gift.copies === 1 ? "one" : "several") : "one");
  const [copies, setCopies] = useState(gift && !gift.pot && gift.copies !== 1 ? String(gift.copies ?? "all") : "all");
  const [photo, setPhoto] = useState<Photo>({ kind: "keep" });
  const [reading, setReading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const shown = photo.kind === "keep" ? (gift?.photo ?? null) : photo.kind === "remove" ? null : photo.kind === "data" ? photo.dataUrl : photo.url;
  const taken = (gift?.offers.length ?? 0) > 0;
  const looksLikeLink = /^https?:\/\/\S+\.\S+/i.test(url.trim());

  async function fill() {
    setReading(true);
    setHint("");
    const result = await letterPreviewAction(code, url.trim()).catch(() => ({ ok: false as const, error: "Pas de connexion — réessaie." }));
    setReading(false);
    if (!result.ok) return setHint(result.error);
    const filled: string[] = [];
    if (result.title && !title.trim()) {
      setTitle(result.title.slice(0, 120));
      filled.push("le nom");
    }
    if (result.price && !price.trim()) {
      setPrice(result.price);
      filled.push("le prix");
    }
    if (result.photo && !shown) {
      setPhoto({ kind: "stored", id: result.photo.id, url: result.photo.url });
      filled.push("la photo");
    }
    const found = !!(result.title || result.price || result.photo);
    setHint(
      filled.length > 0
        ? `Repris de ${siteOf(url)} : ${joinNames(filled)}. Vérifie avant d'enregistrer.`
        : found
          ? "Ce que tu avais déjà rempli est gardé : rien n'a été remplacé."
          : `${siteOf(url)} ne donne ni nom, ni prix, ni photo : remplis la fiche à la main, le lien sera gardé.`,
    );
  }

  async function save() {
    setError("");
    setSaving(true);
    const result = await onSave({
      title,
      url,
      price,
      note,
      secondHand,
      favorite,
      copies: mode === "several" ? (copies === "all" ? null : Number(copies)) : 1,
      pot: mode === "pot",
      photo: photo.kind === "stored" ? { kind: "stored", id: photo.id } : photo,
    });
    setSaving(false);
    if (result) setError(result);
    else onClose();
  }

  const field = "santa-field min-h-11 w-full px-3";
  const label = "flex flex-col gap-1 text-sm font-semibold";
  const help = "text-xs font-normal text-[var(--s-muted)]";

  return (
    <div className="lettre-row flex flex-col gap-4 p-3 sm:p-4">
      <p className="font-display text-lg font-extrabold">{gift ? "Modifier le cadeau" : "Nouveau cadeau"}</p>

      <div className={label}>
        <label htmlFor={`${ids}-url`}>Un lien d&apos;exemple (facultatif)</label>
        <div className="flex gap-2">
          <input id={`${ids}-url`} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" maxLength={2000} className={`${field} min-w-0 flex-1`} />
          <button type="button" className="santa-btn-ghost min-h-11 shrink-0 px-3 text-sm" disabled={!looksLikeLink || reading || busy} onClick={() => void fill()}>
            {reading ? "Lecture…" : "🔗 Remplir"}
          </button>
        </div>
        <span className={help}>
          Colle la page d&apos;un magasin : le nom, le prix et la photo se remplissent tout seuls, sur la plupart des sites. Ce n&apos;est qu&apos;un exemple, la famille
          l&apos;achète où elle veut.
        </span>
        {hint && (
          <span role="status" className="text-xs font-normal text-[var(--s-green)]">
            {hint}
          </span>
        )}
      </div>

      <label className={label}>
        Le cadeau
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Une draisienne rouge" className={field} />
      </label>

      <div className={label}>
        <span>La photo</span>
        <ImagePicker current={shown} label="la photo" busy={busy} onPick={(dataUrl) => setPhoto({ kind: "data", dataUrl })} onRemove={() => setPhoto({ kind: "remove" })} />
      </div>

      <label className={label}>
        {mode === "pot" ? "Montant à réunir" : "Prix indicatif"}
        <span className="flex items-center gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" maxLength={12} placeholder="35" className={`${field} max-w-36`} />
          <span aria-hidden="true">€</span>
        </span>
      </label>

      <label className={label}>
        Une précision ?
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Taille 116, en bleu, sans piles…" className={field} />
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="h-5 w-5 accent-[var(--s-green)]" />
          ⭐ Un des préférés {de(childName)}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={secondHand} onChange={(e) => setSecondHand(e.target.checked)} className="h-5 w-5 accent-[var(--s-green)]" />
          ♻️ D&apos;occasion, c&apos;est très bien
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-semibold">Qui peut l&apos;offrir ?</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name={`${ids}-mode`} checked={mode === "one"} disabled={taken && gift?.pot} onChange={() => setMode("one")} className="h-5 w-5 accent-[var(--s-green)]" />
          Une seule personne
        </label>
        <div className="flex flex-wrap items-center gap-x-3">
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name={`${ids}-mode`} checked={mode === "several"} disabled={taken && gift?.pot} onChange={() => setMode("several")} className="h-5 w-5 accent-[var(--s-green)]" />
            Plusieurs personnes
          </label>
          {mode === "several" && (
            <select value={copies} onChange={(e) => setCopies(e.target.value)} aria-label="Combien de personnes peuvent l'offrir" className="santa-field min-h-11 px-2">
              <option value="all">autant qu&apos;on veut</option>
              {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} au plus
                </option>
              ))}
            </select>
          )}
        </div>
        {mode === "several" && <span className={help}>Pour des livres, des Lego… : chacun en offre un.</span>}
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name={`${ids}-mode`} checked={mode === "pot"} disabled={taken && !gift?.pot} onChange={() => setMode("pot")} className="h-5 w-5 accent-[var(--s-green)]" />
          💶 Tout le monde peut participer : une cagnotte
        </label>
        {mode === "pot" && (
          <span className={help}>
            Pour un gros cadeau : chacun promet une part, la jauge monte jusqu&apos;au montant, et l&apos;argent arrive par Wero ou autrement. Le CLHUB ne touche jamais à
            l&apos;argent.
          </span>
        )}
        {taken && <span className={help}>{gift?.pot ? "Des parts sont déjà promises : la cagnotte le reste." : "Déjà réservé : il ne peut plus devenir une cagnotte."}</span>}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-[var(--s-red)]">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="santa-btn min-h-12 px-4" disabled={busy || saving || !title.trim()} onClick={() => void save()}>
          {saving ? "Enregistrement…" : gift ? "Enregistrer le cadeau" : "Ajouter le cadeau"}
        </button>
        <button type="button" className="santa-btn-ghost min-h-12 px-4" onClick={onClose}>
          Fermer sans enregistrer
        </button>
      </div>
    </div>
  );
}
