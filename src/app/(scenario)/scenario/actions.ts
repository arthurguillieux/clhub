"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import {
  act,
  checkConsole,
  createEvening,
  deleteEvening,
  deleteSimulations,
  simulateEvening,
  finish,
  getByToken,
  rewind,
  getConsoleView,
  launch,
  openStation,
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

/** « Simuler une partie »: a fictive evening, ready at the chosen moment, and straight to its console. */
export async function simulateAction(scenarioId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const def = scenarioOf(scenarioId);
  if (!def || !(await unlockedScenarios(session.member.id)).includes(def.id)) return { status: "error", message: "Ce scénario n'est pas ouvert." };
  const start = z.enum(["b1-arrival", "b1-day3", "reboot", "b2-arrival", "b2-day3"]).safeParse(formData.get("start"));
  if (!start.success) return { status: "error", message: "Choisis un moment de départ." };
  const result = await simulateEvening(session.member.id, def, start.data);
  if (!result.ok) return { status: "error", message: result.error };
  // Phone and projection side by side: a rehearsal is checked on one screen.
  redirect(`/scenario/${result.game.code}/repetition`);
}

export async function deleteSimulationsAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  await deleteSimulations(session.member.id);
  redirect("/jeux/loups/scenarios");
}

export async function newEveningAction(scenarioId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const def = scenarioOf(scenarioId);
  if (!def || !(await unlockedScenarios(session.member.id)).includes(def.id)) redirect("/jeux/loups/scenarios");
  // One station at a time: opening it again (on the phone, then on the computer) lands on the same one.
  const game = (await openStation(session.member.id, def.id)) ?? (await createEvening(session.member.id, def, null));
  redirect(`/scenario/${game.code}/console`);
}

const id = z.string().min(1).max(64);
const player = z.string().regex(/^p\d{1,3}$/);
const text = (max: number) => z.string().trim().max(max);

const eventSchema = z.object({ id, name: text(40).min(1, "Un événement sans nom ?"), rule: text(160).min(1, "Il manque la règle de l'événement."), effect: z.enum(["blizzard", "aurora", "gauge", "dark", "quarantine", "parity", "confinement"]).optional(), text: id.optional() });
const faultSchema = z.object({
  id,
  title: text(80).min(1, "Il manque le titre de la faille."),
  loops: z.array(z.number().int().min(1).max(9)).min(1).max(9),
  kind: z.enum(["terminalFile", "glitch", "tracker", "image", "text"]),
  terminal: id.optional(),
  file: id.optional(),
  media: id.optional(),
  text: text(400).optional(),
  zone: id.optional(),
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
    voteDoorSeconds: z.number().int().min(10).max(600).optional(),
    voteDeadSeconds: z.number().int().min(10).max(600).optional(),
    voteChiefSeconds: z.number().int().min(10).max(900).optional(),
    confinementSeconds: z.number().int().min(30).max(1800).optional(),
  }),
  events: z.array(eventSchema).max(20),
  extraFaults: z.array(faultSchema).max(20),
  files: z
    .record(
      id,
      z.object({ name: text(40).optional(), date: text(20).optional(), text: z.string().max(8000).optional(), subs: z.string().max(8000).optional() }),
    )
    .optional(),
  dates: z.object({ world: text(20).optional(), real: text(20).optional() }).optional(),
  texts: z
    .object({
      imported: z
        .object({
          version: z.string().max(40).optional(),
          textes: z.array(z.object({ id, partie: z.string().max(80), titre: z.string().max(200), quand: z.string().max(2000), texte: z.string().max(20000) })).max(400),
        })
        .optional(),
      edited: z.record(id, z.string().max(20000)).optional(),
    })
    .optional(),
});

const actionSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("load") }),
  z.object({ t: z.literal("unload") }),
  z.object({ t: z.literal("screen"), mode: z.enum(["accueil", "plan"]) }),
  z.object({ t: z.literal("reset") }),
  z.object({ t: z.literal("start") }),
  z.object({ t: z.literal("arrive") }),
  z.object({ t: z.literal("patientZero"), player }),
  z.object({ t: z.literal("light"), on: z.boolean() }),
  z.object({ t: z.literal("cut") }),
  z.object({ t: z.literal("door"), door: id, open: z.boolean(), force: z.boolean().optional() }),
  z.object({
    t: z.literal("timer"),
    which: z.enum(["gauge", "main"]),
    cmd: z.enum(["start", "pause", "resume", "plus", "minus", "stop"]),
    seconds: z.number().int().min(5).max(3600).optional(),
    label: text(40).optional(),
  }),
  z.object({ t: z.literal("faultToggle"), id: id.nullable(), on: z.boolean() }),
  z.object({ t: z.literal("stop") }),
  z.object({ t: z.literal("neutral"), mode: z.enum(["plan", "black"]).nullable() }),
  z.object({ t: z.literal("media"), cmd: z.enum(["play", "pause", "restart", "back", "forward"]) }),
  z.object({ t: z.literal("jump"), phase: z.enum(["welcome", "bus", "arrival", "night", "day", "loopEnd", "good", "bad"]) }),
  z.object({ t: z.literal("room"), player, room: z.number().int().min(1).max(40) }),
  z.object({ t: z.literal("terminal"), id: id.nullable() }),
  z.object({ t: z.literal("play"), file: id }),
  z.object({ t: z.literal("circuit"), show: z.boolean() }),
  z.object({ t: z.literal("switch"), index: z.number().int().min(0).max(3), up: z.boolean() }),
  z.object({ t: z.literal("power") }),
  z.object({ t: z.literal("glitch") }),
  z.object({ t: z.literal("blizzard"), on: z.boolean() }),
  z.object({ t: z.literal("dark"), on: z.boolean() }),
  z.object({ t: z.literal("aurora"), on: z.boolean() }),
  z.object({ t: z.literal("gauge"), seconds: z.number().int().min(10).max(1200).nullable() }),
  z.object({ t: z.literal("intrusion"), text: z.string().max(600).nullable() }),
  z.object({ t: z.literal("sound"), slot: id }),
  z.object({ t: z.literal("stopSound"), slot: id.nullable() }),
  z.object({ t: z.literal("record") }),
  z.object({ t: z.literal("fault"), id }),
  z.object({ t: z.literal("night") }),
  z.object({ t: z.literal("panic"), player: player.nullable() }),
  z.object({ t: z.literal("tapes"), target: player.nullable() }),
  z.object({ t: z.literal("infect"), player: player.nullable() }),
  z.object({ t: z.literal("victim"), player: player.nullable() }),
  z.object({ t: z.literal("useItem"), item: id, target: player.nullable() }),
  z.object({ t: z.literal("giveItem"), item: id, player: player.nullable() }),
  z.object({ t: z.literal("propose"), events: z.array(id).max(5) }),
  z.object({ t: z.literal("deadChoose"), event: id.nullable() }),
  z.object({ t: z.literal("skip"), step: z.enum(["pz", "handover", "panic", "tapes", "infect", "victim", "items", "dead"]) }),
  z.object({ t: z.literal("dawn") }),
  z.object({ t: z.literal("exile"), player: player.nullable() }),
  z.object({ t: z.literal("kill"), player }),
  z.object({ t: z.literal("revive"), player }),
  z.object({ t: z.literal("setInfected"), player, infected: z.boolean() }),
  z.object({ t: z.literal("endLoop"), winner: z.enum(["village", "meute"]) }),
  z.object({ t: z.literal("reboot") }),
  z.object({ t: z.literal("goodEnd") }),
  z.object({ t: z.literal("badEnd") }),
  z.object({ t: z.literal("vote"), kind: z.enum(["door", "dead", "chief"]), options: z.array(id).min(1).max(40) }),
  z.object({ t: z.literal("voteResult"), choice: id.nullable() }),
  z.object({ t: z.literal("dayAction"), id }),
  z.object({ t: z.literal("labForce") }),
  z.object({ t: z.literal("chief"), player: player.nullable() }),
  z.object({ t: z.literal("chiefConfirm") }),
  z.object({ t: z.literal("shoot"), target: player }),
  z.object({ t: z.literal("bloodTest"), target: player }),
  z.object({ t: z.literal("radio") }),
  z.object({ t: z.literal("quarantine"), players: z.array(player).max(2) }),
  z.object({ t: z.literal("confinement"), on: z.boolean() }),
  z.object({ t: z.literal("flag"), flag: z.enum(["key", "badge2", "badge3", "code", "power"]), on: z.boolean() }),
]);

const consoleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refresh") }),
  z.object({ type: z.literal("setup"), setup: setupSchema }),
  z.object({ type: z.literal("launch") }),
  z.object({ type: z.literal("act"), action: actionSchema }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("rewind"), seq: z.number().int().min(0) }),
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
      case "rewind":
        return rewind(game, a.seq);
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
