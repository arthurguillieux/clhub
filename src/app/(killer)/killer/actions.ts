"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { grantKillerAccess, hasKillerAccess, isKillerPassword } from "@/modules/killer/access";
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

export type UnlockState = { status: "idle" } | { status: "error"; message: string };

export async function unlockKillerAction(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Tu dois être connecté." };
  if (!isKillerPassword(String(formData.get("password") ?? ""))) return { status: "error", message: "Ce n'est pas le bon mot de passe." };
  await grantKillerAccess(session.member.id);
  redirect("/jeux/killer");
}

export async function createKillerGameAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !(await hasKillerAccess(session.member.id))) redirect("/jeux/killer");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80) || "Les Jeux du Killer";
  const game = await createGame(session.member.id, title);
  redirect(`/killer/${game.code}/panneau`);
}

export async function createKillerDemoAction(): Promise<void> {
  const session = await getSession();
  if (!session || !(await hasKillerAccess(session.member.id))) redirect("/jeux/killer");
  await createDemoGame(session.member.id);
  redirect("/jeux/killer");
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
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("removePhoto"), playerId: id }),
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
                          : await endGame(game);
  if (!result.ok) return { ok: false, error: result.error };

  const fresh = await getGameByCode(code);
  return fresh ? { ok: true, view: await getHostView(fresh) } : { ok: false, error: "Cette partie n'existe plus." };
}

export async function deleteKillerGameAction(code: string): Promise<void> {
  const check = await checkKillerHost(code);
  if (check.ok) await deleteGame(check.game);
  redirect("/jeux/killer");
}
