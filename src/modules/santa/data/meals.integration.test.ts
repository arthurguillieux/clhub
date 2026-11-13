/**
 * Integration test — needs a live Postgres with migrations applied (DATABASE_URL).
 * Who may change what on the meals: participants come with nothing but their link, so the rules
 * are checked against the real tables.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/core/db/client";
import { member, santaEvent, user, type SantaEvent } from "@/core/db/schema";
import { addGuestParticipant, createEvent, getEventByCode, loadParticipants } from "./events";
import { addDish, addDrink, getMealsView, removeDish, removeDrink, setPresence, setProfile, takeIdea, toggleMeal, updateMealsSettings } from "./meals";

describe("Secret Santa meals", () => {
  let userId: string;
  let memberId: string;
  let event: SantaEvent;
  let alice: string;
  let bob: string;
  const fresh = async () => (await getEventByCode(event.code))!;
  const asAlice = () => ({ me: alice, organizer: false });
  const asBob = () => ({ me: bob, organizer: false });
  const asOrganizer = { me: null, organizer: true };

  beforeAll(async () => {
    userId = randomUUID();
    await db.insert(user).values({ id: userId, email: `test-${userId}@example.com`, name: "Test Member", emailVerified: true });
    memberId = (await db.insert(member).values({ userId }).returning())[0]!.id;
    event = await createEvent(memberId, "Noël des repas");
    await addGuestParticipant(event, "Alice", `alice-${userId}@example.com`);
    await addGuestParticipant(event, "Bob", `bob-${userId}@example.com`);
    const people = await loadParticipants(event.id);
    alice = people.find((p) => p.name === "Alice")!.id;
    bob = people.find((p) => p.name === "Bob")!.id;
  });

  afterAll(async () => {
    await db.delete(santaEvent).where(eq(santaEvent.hostMemberId, memberId));
    await db.delete(member).where(inArray(member.id, [memberId]));
    await db.delete(user).where(inArray(user.id, [userId]));
  });

  it("stays shut until the organizers turn it on", async () => {
    const result = await setProfile(await fresh(), asAlice(), { diet: "Végétarienne", guests: 0 });
    expect(result.ok).toBe(false);
  });

  it("refuses a range that runs backwards or lasts weeks", async () => {
    expect((await updateMealsSettings(await fresh(), { enabled: true, from: "2026-12-25", to: "2026-12-23", note: "" })).ok).toBe(false);
    expect((await updateMealsSettings(await fresh(), { enabled: true, from: "2026-12-01", to: "2026-12-31", note: "" })).ok).toBe(false);
  });

  it("creates a lunch and a dinner for each day of the range", async () => {
    expect((await updateMealsSettings(await fresh(), { enabled: true, from: "2026-12-23", to: "2026-12-25", note: "Qui cuisine fait la vaisselle." })).ok).toBe(true);
    const view = await getMealsView(await fresh(), asAlice());
    expect(view.days.map((d) => d.day)).toEqual(["2026-12-23", "2026-12-24", "2026-12-25"]);
    expect(view.days[0]!.meals.map((m) => m.meal)).toEqual(["midi", "soir"]);
    expect(view.note).toBe("Qui cuisine fait la vaisselle.");
  });

  it("lets each participant answer for themselves only", async () => {
    const view = await getMealsView(await fresh(), asAlice());
    const lunch = view.days[0]!.meals[0]!.id;
    expect((await setPresence(await fresh(), asAlice(), { mealId: lunch, value: "x" })).ok).toBe(true);
    expect((await setPresence(await fresh(), asAlice(), { participantId: bob, mealId: lunch, value: "x" })).ok).toBe(false);
    expect((await setPresence(await fresh(), asOrganizer, { participantId: bob, mealId: lunch, value: "?" })).ok).toBe(true);
    const after = await getMealsView(await fresh(), asAlice());
    expect(after.people.find((p) => p.id === alice)!.presence[lunch]).toBe("x");
    expect(after.people.find((p) => p.id === bob)!.presence[lunch]).toBe("?");
  });

  it("keeps a dish to whoever brings it, and the organizers", async () => {
    const lunch = (await getMealsView(await fresh(), asAlice())).days[0]!.meals[0]!.id;
    await addDish(await fresh(), asAlice(), { mealId: lunch, what: "Tarte aux champignons", category: "Plat", parts: 6, veg: true, note: "", withId: null, idea: false });
    const dish = (await getMealsView(await fresh(), asAlice())).dishes.find((d) => d.what === "Tarte aux champignons")!;
    expect(dish.who).toBe(alice);
    expect((await removeDish(await fresh(), asBob(), dish.id)).ok).toBe(false);
    expect((await removeDish(await fresh(), asOrganizer, dish.id)).ok).toBe(true);
    expect((await getMealsView(await fresh(), asAlice())).dishes).toHaveLength(0);
  });

  it("turns an idea into someone's dish when they take it", async () => {
    const lunch = (await getMealsView(await fresh(), asAlice())).days[0]!.meals[0]!.id;
    await addDish(await fresh(), asAlice(), { mealId: lunch, what: "Une bûche ?", category: "Dessert", parts: 8, veg: true, note: "", withId: bob, idea: true });
    const idea = (await getMealsView(await fresh(), asAlice())).dishes.find((d) => d.idea)!;
    expect(idea.parts).toBeNull(); // an idea promises no portions, and nobody with it
    expect(idea.withId).toBeNull();
    expect((await takeIdea(await fresh(), asBob(), { id: idea.id })).ok).toBe(true);
    const taken = (await getMealsView(await fresh(), asAlice())).dishes.find((d) => d.id === idea.id)!;
    expect(taken).toMatchObject({ idea: false, who: bob });
    expect((await takeIdea(await fresh(), asAlice(), { id: idea.id })).ok).toBe(false);
  });

  it("hides a meal turned off, with what was planned for it, and brings both back", async () => {
    const lunch = (await getMealsView(await fresh(), asAlice())).days[0]!.meals[0]!.id;
    await toggleMeal(await fresh(), lunch);
    const hidden = await getMealsView(await fresh(), asAlice());
    expect(hidden.days[0]!.meals.map((m) => m.meal)).toEqual(["soir"]);
    expect(hidden.dishes).toHaveLength(0);
    await toggleMeal(await fresh(), lunch);
    expect((await getMealsView(await fresh(), asAlice())).dishes).toHaveLength(1);
  });

  it("keeps drinks to whoever brings them", async () => {
    await addDrink(await fresh(), asAlice(), { type: "Vin rouge", quantity: 2, unit: "bouteilles", what: "Bourgueil" });
    const drink = (await getMealsView(await fresh(), asAlice())).drinks[0]!;
    expect((await removeDrink(await fresh(), asBob(), drink.id)).ok).toBe(false);
    expect((await removeDrink(await fresh(), asAlice(), drink.id)).ok).toBe(true);
  });

  it("freezes everything once the event is archived", async () => {
    await db.update(santaEvent).set({ archivedAt: new Date() }).where(eq(santaEvent.id, event.id));
    expect((await setProfile(await fresh(), asAlice(), { diet: "Sans gluten", guests: 1 })).ok).toBe(false);
  });
});
