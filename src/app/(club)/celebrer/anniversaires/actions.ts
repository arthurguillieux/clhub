"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { typedEuros } from "@/core/money";
import { flash } from "@/core/ui/flash";
import {
  addIdea,
  answer,
  birthdayPath,
  choose,
  createBirthday,
  deleteBirthday,
  inviteMore,
  markRepaid,
  removeIdea,
  setPrice,
  takeCharge,
  toggleVote,
} from "@/modules/anniversaire/data";

type Result = { ok: true } | { ok: false; error: string };

async function me() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return { id: session.member.id, name: session.user.name || "Quelqu'un" };
}

const euros = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : typedEuros(v)),
  z.number({ error: "Écris un prix, par exemple 25,50." }).positive("Le prix doit être supérieur à 0.").max(100000).nullable(),
);
const uuid = z.string().uuid();

export type NewBirthdayState = { status: "idle" } | { status: "error"; message: string };

const newSchema = z.object({
  who: z.enum(["member", "other"]),
  honoreeMemberId: z.string().optional(),
  honoreeName: z.string().trim().max(60).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisis la date de l'anniversaire."),
  note: z.string().trim().max(500).default(""),
});

export async function createBirthdayAction(_prev: NewBirthdayState, formData: FormData): Promise<NewBirthdayState> {
  const { id: creatorId, name: creatorName } = await me();
  const parsed = newSchema.safeParse({
    who: formData.get("who"),
    honoreeMemberId: formData.get("honoreeMemberId") ?? undefined,
    honoreeName: formData.get("honoreeName") ?? undefined,
    eventDate: formData.get("eventDate"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };
  const d = parsed.data;
  let honoreeMemberId: string | null = null;
  let honoreeName = d.honoreeName ?? "";
  if (d.who === "member") {
    if (!d.honoreeMemberId || !uuid.safeParse(d.honoreeMemberId).success) return { status: "error", message: "Choisis le membre qu'on fête." };
    honoreeMemberId = d.honoreeMemberId;
    honoreeName = String(formData.get("honoreeMemberName") ?? "").trim() || honoreeName;
  }
  if (!honoreeName) return { status: "error", message: "Écris le prénom de la personne qu'on fête." };
  const inviteeIds = formData.getAll("invitees").map(String).filter((v) => uuid.safeParse(v).success);
  const res = await createBirthday({ creatorId, creatorName, honoreeMemberId, honoreeName, eventDate: d.eventDate, note: d.note, inviteeIds });
  if (!res.ok) return { status: "error", message: res.error };
  revalidatePath("/celebrer");
  await flash(inviteeIds.length ? "Anniversaire créé : les invités sont prévenus" : "Anniversaire créé");
  redirect(birthdayPath(res.id));
}

function done(id: string, r: Result): Result {
  if (r.ok) {
    revalidatePath(birthdayPath(id));
    revalidatePath("/celebrer");
  }
  return r;
}

export async function answerAction(id: string, value: "yes" | "no"): Promise<Result> {
  return done(id, await answer(id, (await me()).id, value));
}

export async function inviteMoreAction(id: string, memberIds: string[]): Promise<Result> {
  const m = await me();
  return done(id, await inviteMore(id, m.id, m.name, memberIds.filter((v) => uuid.safeParse(v).success)));
}

const ideaSchema = z.object({
  title: z.string().trim().min(1, "Écris l'idée.").max(120),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Le lien doit commencer par http:// ou https://.")
    .transform((v) => v || null),
  price: euros,
  note: z.string().trim().max(300).default(""),
});

export async function addIdeaAction(id: string, input: { title: string; url: string; price: string; note: string }): Promise<Result> {
  const parsed = ideaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Idée incomplète." };
  const p = parsed.data;
  return done(id, await addIdea(id, (await me()).id, { title: p.title, url: p.url, priceCents: p.price === null ? null : Math.round(p.price * 100), note: p.note }));
}

export async function removeIdeaAction(id: string, ideaId: string): Promise<Result> {
  return done(id, await removeIdea(id, (await me()).id, ideaId));
}

export async function voteAction(id: string, ideaId: string): Promise<Result> {
  return done(id, await toggleVote(id, (await me()).id, ideaId));
}

export async function chooseAction(id: string, ideaId: string | null): Promise<Result> {
  return done(id, await choose(id, (await me()).id, ideaId));
}

export async function takeChargeAction(id: string, take: boolean): Promise<Result> {
  return done(id, await takeCharge(id, (await me()).id, take));
}

export async function setPriceAction(id: string, price: string | null): Promise<Result> {
  if (price === null) return done(id, await setPrice(id, (await me()).id, null));
  const parsed = euros.safeParse(price);
  if (!parsed.success || parsed.data === null) return { ok: false, error: parsed.success ? "Écris le prix payé." : (parsed.error.issues[0]?.message ?? "Prix invalide.") };
  return done(id, await setPrice(id, (await me()).id, Math.round(parsed.data * 100)));
}

export async function repaidAction(id: string, payerId: string, repaid: boolean): Promise<Result> {
  return done(id, await markRepaid(id, (await me()).id, payerId, repaid));
}

export async function deleteBirthdayAction(id: string): Promise<Result> {
  const r = await deleteBirthday(id, (await me()).id);
  if (!r.ok) return r;
  revalidatePath("/celebrer");
  await flash("Anniversaire supprimé");
  redirect("/celebrer/anniversaires");
}
