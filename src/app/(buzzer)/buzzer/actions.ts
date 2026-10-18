"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import { isAdminModeActive } from "@/core/auth/admin";
import { applyHost, createRoom, endRoom, getRoom, type BuzzerRoom } from "@/modules/jeux/data/buzzerRooms";
import type { BuzzerView } from "@/modules/jeux/domain/buzzer";

/** Any logged-in member can start a game; they become its host. */
export async function createGameAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const room = createRoom(session.member.id, session.user.name);
  redirect(`/buzzer/${room.code}/animateur`);
}

const teamId = z.string().min(1).max(40);

const hostActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("open") }),
  z.object({ type: z.literal("close") }),
  z.object({ type: z.literal("cancel") }),
  z.object({ type: z.literal("wrong") }),
  z.object({ type: z.literal("correct"), points: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal("score"), teamId, delta: z.number().int().min(-1000).max(1000) }),
  z.object({ type: z.literal("rename"), teamId, name: z.string().max(100) }),
  z.object({ type: z.literal("remove"), teamId }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("lobby") }),
  z.object({ type: z.literal("resetAll") }),
]);

export type HostActionResult = { ok: true; view: BuzzerView } | { ok: false; error: string };

/** Only the member who started the game, or an admin in admin mode, may drive it. */
async function findOwnedRoom(code: string): Promise<{ room: BuzzerRoom } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Tu dois être connecté." };

  const room = getRoom(code);
  if (!room) return { error: "Cette partie n'existe plus." };

  if (room.hostMemberId !== session.member.id && !(await isAdminModeActive())) {
    return { error: "Cette partie n'est pas la tienne." };
  }
  return { room };
}

export async function hostAction(code: string, action: unknown): Promise<HostActionResult> {
  const found = await findOwnedRoom(code);
  if ("error" in found) return { ok: false, error: found.error };

  const parsed = hostActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: "Action invalide." };

  return { ok: true, view: applyHost(found.room, parsed.data) };
}

export async function endGameAction(code: string): Promise<void> {
  const found = await findOwnedRoom(code);
  if ("room" in found) endRoom(found.room);
  redirect("/jeux/buzzer");
}
