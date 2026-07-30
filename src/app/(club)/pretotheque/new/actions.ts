"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/core/activity";
import { getSession } from "@/core/auth/session";
import { saveItemPhoto } from "@/core/storage/itemPhoto";
import { createItem, setItemPhoto } from "@/modules/pretotheque/data/items";
import { fetchOpenGraphMetadata, type OpenGraphMetadata } from "@/core/opengraph";
import { itemFormSchema, itemFormDataToInput } from "@/modules/pretotheque/itemFormSchema";

export async function fetchProductMetadataAction(
  productUrl: string,
): Promise<OpenGraphMetadata | null> {
  const session = await getSession();
  if (!session) return null;
  if (!z.url().safeParse(productUrl).success) return null;

  return fetchOpenGraphMetadata(productUrl);
}

export type CreateItemFormState = { status: "idle" } | { status: "error"; message: string };

export async function createItemAction(
  _prevState: CreateItemFormState,
  formData: FormData,
): Promise<CreateItemFormState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Tu dois être connecté." };
  }

  const parsed = itemFormSchema.safeParse(itemFormDataToInput(formData));

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const created = await createItem(session.member.id, parsed.data);

  const photo = formData.get("photo");
  const ogImageUrl = formData.get("ogImageUrl");
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const path = await saveItemPhoto(created.id, buffer);
    await setItemPhoto(created.id, path);
  } else if (typeof ogImageUrl === "string" && ogImageUrl && z.url().safeParse(ogImageUrl).success) {
    // The "récupérer les infos" preview image — hotlinked as-is rather than
    // downloaded and reprocessed through sharp, unlike a real file upload.
    await setItemPhoto(created.id, ogImageUrl);
  }

  await logActivity({
    section: "pretotheque",
    kind: "item.created",
    actorId: session.member.id,
    subjectRef: `item:${created.id}`,
    payload: { name: created.name, category: created.category },
  });

  redirect(`/pretotheque/${created.slug}`);
}
