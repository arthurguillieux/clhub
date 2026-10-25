"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import {
  MAX_MISSION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  addTribute,
  createGame,
  deleteGame,
  eliminatePlayer,
  endGame,
  getGameByCode,
  getHostView,
  releaseSeat,
  removePhoto,
  removeAllPhotos,
  setArchived,
  setCohostPassword,
  joinOrganization,
  addCohost,
  removeCohost,
  renameGame,
  resetToLobby,
  saveLobby,
  shuffleLobby,
  startGame,
  undoLastKill,
  updateMission,
} from "@/modules/killer/data/games";
import { createDemoGame } from "@/modules/killer/data/demo";
import { checkKillerHost } from "@/modules/killer/host";
import type { HostGameView } from "@/modules/killer/views";

/** `values` puts back what was typed: React empties a form once its action has run, even on an error. */
export type FormState = { status: "idle" } | { status: "error"; message: string; values?: Record<string, string> };

/** A new game — with, optionally, a password that lets other members co-organize it. */
export async function createKillerGameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80) || "Les Jeux du Killer";
  const password = String(formData.get("password") ?? "").trim();
  if (password && password.length < 4) {
    return { status: "error", message: "Le mot de passe doit faire au moins 4 caractères (ou laisse le champ vide).", values: { title, password } };
  }
  const game = await createGame(session.member.id, title);
  if (password) await setCohostPassword(game, password);
  redirect(`/killer/${game.code}/panneau`);
}

export async function createKillerDemoAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  await createDemoGame(session.member.id);
  redirect("/jeux/killer");
}

/** A member joins a game's organization with its code and co-organization password. */
export async function joinOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const game = code ? await getGameByCode(code) : null;
  if (!game) return { status: "error", message: "Aucune partie ne porte ce code.", values: { code } };
  const result = await joinOrganization(game, session.member.id, String(formData.get("password") ?? ""));
  if (!result.ok) return { status: "error", message: result.error, values: { code } };
  redirect(game.archivedAt ? `/killer/${game.code}/archive` : `/killer/${game.code}/panneau`);
}

const name = z.string().trim().min(1, "Un prénom est vide.").max(MAX_NAME_LENGTH, "Prénom trop long.");
const mission = z.string().max(MAX_MISSION_LENGTH, "Mission trop longue.");
const id = z.string().uuid();

const hostActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("saveLobby"),
    rows: z.array(z.object({ id: id.nullable(), name, mission })).max(80),
  }),
  z.object({ type: z.literal("shuffle") }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("eliminate"), playerId: id }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("add"), name, mission, afterId: id.nullable() }),
  z.object({ type: z.literal("release"), playerId: id }),
  z.object({ type: z.literal("mission"), playerId: id, mission }),
  z.object({ type: z.literal("end") }),
  z.object({ type: z.literal("cohostPassword"), password: z.string().max(100).nullable() }),
  z.object({ type: z.literal("archive"), archived: z.boolean() }),
  z.object({ type: z.literal("removeAllPhotos") }),
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("removePhoto"), playerId: id }),
  z.object({ type: z.literal("addCohost"), memberId: id }),
  z.object({ type: z.literal("removeCohost"), memberId: id }),
  z.object({ type: z.literal("rename"), title: z.string().trim().min(1, "Le nom de la partie ne peut pas être vide.").max(MAX_TITLE_LENGTH, "Nom trop long.") }),
]);

export type KillerHostResult = { ok: true; view: HostGameView } | { ok: false; error: string };

export async function killerHostAction(code: string, action: unknown): Promise<KillerHostResult> {
  const check = await checkKillerHost(code);
  if (!check.ok) return { ok: false, error: "Tu n'as pas accès à cette partie." };

  const parsed = hostActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };

  const game = check.game;
  const a = parsed.data;
  if ((a.type === "addCohost" || a.type === "removeCohost" || a.type === "cohostPassword") && check.role !== "host") {
    return { ok: false, error: "Seule la personne qui a créé la partie peut choisir ses co-organisateurs." };
  }
  const result =
    a.type === "saveLobby"
      ? await saveLobby(game, a.rows)
      : a.type === "shuffle"
        ? await shuffleLobby(game)
        : a.type === "start"
          ? await startGame(game)
          : a.type === "eliminate"
            ? await eliminatePlayer(game, a.playerId)
            : a.type === "undo"
              ? await undoLastKill(game)
              : a.type === "add"
                ? await addTribute(game, a.name, a.mission, a.afterId)
                : a.type === "release"
                  ? await releaseSeat(game, a.playerId)
                  : a.type === "mission"
                    ? await updateMission(game, a.playerId, a.mission)
                    : a.type === "reset"
                      ? await resetToLobby(game)
                      : a.type === "removePhoto"
                        ? await removePhoto(game, a.playerId)
                        : a.type === "rename"
                          ? await renameGame(game, a.title)
                          : a.type === "addCohost"
                            ? await addCohost(game, a.memberId)
                            : a.type === "removeCohost"
                              ? await removeCohost(game, a.memberId)
                              : a.type === "cohostPassword"
                                ? await setCohostPassword(game, a.password)
                                : a.type === "archive"
                                  ? await setArchived(game, a.archived)
                                  : a.type === "removeAllPhotos"
                                    ? await removeAllPhotos(game)
                                    : await endGame(game);
  if (!result.ok) return { ok: false, error: result.error };

  const fresh = await getGameByCode(code);
  return fresh ? { ok: true, view: await getHostView(fresh) } : { ok: false, error: "Cette partie n'existe plus." };
}

export async function deleteKillerGameAction(code: string): Promise<void> {
  const check = await checkKillerHost(code);
  // Only its creator deletes a game; a co-organizer can't.
  if (check.ok && check.role === "host") await deleteGame(check.game);
  redirect("/jeux/killer");
}
