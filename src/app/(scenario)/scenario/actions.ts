"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import {
  act,
  checkConsole,
  createEvening,
  deleteEvening,
  finish,
  getByToken,
  getConsoleView,
  launch,
  reportProjection,
  saveSetup,
  setCohost,
  undo,
  unlock,
  unlockedScenarios,
  type ConsoleView,
  type Result,
} from "@/modules/loups/scenarios/data";
import type { Action, Setup } from "@/modules/loups/scenarios/engine";
import { scenarioOf } from "@/modules/loups/scenarios";

export type FormState = { status: "idle" } | { status: "error"; message: string };

/** The password of a scenario, typed once by a member: it stays open for them. */
export async function unlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const def = scenarioOf(String(formData.get("scenario") ?? ""));
  if (!def) return { status: "error", message: "Ce scénario n'existe pas." };
  const result = await unlock(session.member.id, def, String(formData.get("password") ?? ""));
  if (!result.ok) return { status: "error", message: result.error };
  redirect("/jeux/loups/scenarios");
}

export async function newEveningAction(scenarioId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const def = scenarioOf(scenarioId);
  if (!def || !(await unlockedScenarios(session.member.id)).includes(def.id)) redirect("/jeux/loups/scenarios");
  const game = await createEvening(session.member.id, def, null);
  redirect(`/scenario/${game.code}/console`);
}

const id = z.string().min(1).max(64);
const player = z.string().regex(/^p\d{1,3}$/);
const text = (max: number) => z.string().trim().max(max);

const eventSchema = z.object({ id, name: text(40).min(1, "Un événement sans nom ?"), rule: text(160).min(1, "Il manque la règle de l'événement."), effect: z.enum(["blizzard", "aurora", "gauge"]).optional() });
const faultSchema = z.object({
  id,
  title: text(80).min(1, "Il manque le titre de la faille."),
  loops: z.array(z.number().int().min(1).max(9)).min(1).max(9),
  kind: z.enum(["terminalFile", "glitch", "tracker", "image", "text"]),
  terminal: id.optional(),
  file: id.optional(),
  media: id.optional(),
  text: text(400).optional(),
  missed: text(160),
});
const setupSchema = z.object({
  players: z
    .array(z.object({ id: player, name: text(30).min(1, "Un joueur sans prénom ?") }))
    .max(40, "40 joueurs au plus."),
  params: z.object({
    loops: z.number().int().min(1).max(5),
    contagionNights: z.number().int().min(0).max(10),
    packMax: z.number().int().min(1).max(20),
    circuit: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
    eventsProposed: z.number().int().min(1).max(5),
    hallLitLoop2: z.boolean(),
    gaugeSeconds: z.number().int().min(30).max(1200),
  }),
  events: z.array(eventSchema).max(20),
  extraFaults: z.array(faultSchema).max(20),
});

const actionSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("start") }),
  z.object({ t: z.literal("arrive") }),
  z.object({ t: z.literal("patientZero"), player }),
  z.object({ t: z.literal("light"), on: z.boolean() }),
  z.object({ t: z.literal("cut") }),
  z.object({ t: z.literal("door"), door: id, open: z.boolean() }),
  z.object({ t: z.literal("terminal"), id: id.nullable() }),
  z.object({ t: z.literal("play"), file: id }),
  z.object({ t: z.literal("circuit"), show: z.boolean() }),
  z.object({ t: z.literal("switch"), index: z.number().int().min(0).max(3), up: z.boolean() }),
  z.object({ t: z.literal("power") }),
  z.object({ t: z.literal("glitch") }),
  z.object({ t: z.literal("blizzard"), on: z.boolean() }),
  z.object({ t: z.literal("aurora"), on: z.boolean() }),
  z.object({ t: z.literal("gauge"), seconds: z.number().int().min(10).max(1200).nullable() }),
  z.object({ t: z.literal("intrusion"), text: z.string().max(600).nullable() }),
  z.object({ t: z.literal("sound"), slot: id }),
  z.object({ t: z.literal("stopSound"), slot: id.nullable() }),
  z.object({ t: z.literal("record") }),
  z.object({ t: z.literal("fault"), id }),
  z.object({ t: z.literal("night") }),
  z.object({ t: z.literal("panic"), player: player.nullable() }),
  z.object({ t: z.literal("infect"), player: player.nullable() }),
  z.object({ t: z.literal("victim"), player: player.nullable() }),
  z.object({ t: z.literal("useItem"), item: id, target: player.nullable() }),
  z.object({ t: z.literal("giveItem"), item: id, player: player.nullable() }),
  z.object({ t: z.literal("propose"), events: z.array(id).max(5) }),
  z.object({ t: z.literal("deadChoose"), event: id.nullable() }),
  z.object({ t: z.literal("skip"), step: z.enum(["panic", "infect", "victim", "items", "dead"]) }),
  z.object({ t: z.literal("dawn") }),
  z.object({ t: z.literal("exile"), player: player.nullable() }),
  z.object({ t: z.literal("kill"), player }),
  z.object({ t: z.literal("revive"), player }),
  z.object({ t: z.literal("setInfected"), player, infected: z.boolean() }),
  z.object({ t: z.literal("endLoop"), winner: z.enum(["village", "meute"]) }),
  z.object({ t: z.literal("reboot") }),
  z.object({ t: z.literal("goodEnd") }),
  z.object({ t: z.literal("badEnd") }),
]);

const consoleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refresh") }),
  z.object({ type: z.literal("setup"), setup: setupSchema }),
  z.object({ type: z.literal("launch") }),
  z.object({ type: z.literal("act"), action: actionSchema }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("cohost"), memberId: z.string().uuid(), on: z.boolean() }),
]);

export type ConsoleResult = { ok: true; view: ConsoleView } | { ok: false; error: string };

/** Everything the console does; each call answers with the evening as it now is. */
export async function consoleAction(code: string, input: unknown): Promise<ConsoleResult> {
  const check = await checkConsole(code);
  if (!check.ok) return { ok: false, error: "Ce n'est pas ta soirée." };
  const parsed = consoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  const { game, def } = check;
  if (a.type === "cohost" && check.role !== "host") return { ok: false, error: "Seule la personne qui a créé la soirée choisit ses co-organisateurs." };
  const result: Result = await (async (): Promise<Result> => {
    switch (a.type) {
      case "refresh":
        return { ok: true };
      case "setup":
        return saveSetup(game, a.setup as Setup);
      case "launch":
        return launch(game, def);
      case "act":
        return act(game, a.action as Action);
      case "undo":
        return undo(game);
      case "finish":
        return finish(game);
      case "cohost":
        return setCohost(game, a.memberId, a.on);
    }
  })();
  if (!result.ok) return result;
  const fresh = await checkConsole(code);
  return fresh.ok ? { ok: true, view: await getConsoleView(fresh.game, fresh.def, fresh.role) } : { ok: false, error: "Cette soirée n'existe plus." };
}

/** « Rejouer ce scénario »: a new evening with the same preparation. */
export async function replayEveningAction(code: string): Promise<void> {
  const check = await checkConsole(code);
  if (!check.ok) redirect("/jeux/loups/scenarios");
  const next = await createEvening(check.memberId, check.def, check.game);
  redirect(`/scenario/${next.code}/console`);
}

export async function deleteEveningAction(code: string): Promise<void> {
  const check = await checkConsole(code);
  if (check.ok && check.role === "host") await deleteEvening(check.game);
  redirect("/jeux/loups/scenarios");
}

const reportSchema = z.object({ ready: z.number().int().min(0).max(500), total: z.number().int().min(0).max(500), mic: z.boolean() });

/** The projection computer's heartbeat: alive, how many media it holds, whether it may record. */
export async function projectionReportAction(token: string, report: unknown): Promise<void> {
  const g = await getByToken(token);
  const parsed = reportSchema.safeParse(report);
  if (g && parsed.success) await reportProjection(g, parsed.data);
}
