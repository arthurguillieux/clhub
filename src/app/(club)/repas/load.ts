import { cookies } from "next/headers";
import { isAdminModeActive } from "@/core/auth/admin";
import { getSession } from "@/core/auth/session";
import type { MenuEvent } from "@/core/db/schema";
import { getMeal, getMealByToken, getMealView, guestOfKey, guestOfMember, type Actor, type MealView } from "@/modules/repas/data/meals";

/**
 * Who opens a meal, and what they may see: its organizer (or an admin in admin mode), one of its
 * guests (a member, or a browser that said « c'est moi » on the link), or a member of the club when
 * the meal is open. Not a "use server" file: nothing here may be called from the browser.
 */
/** Where the meal is reached from: its page in the club, or its link for guests without an account. */
export type MealRef = { id: string } | { token: string };

export const cookieName = (meal: MenuEvent) => `repas_${meal.id.slice(0, 8)}`;

export async function resolve(ref: MealRef) {
  const meal = "id" in ref ? await getMeal(ref.id) : await getMealByToken(ref.token);
  if (!meal) return null;
  const session = await getSession();
  const admin = await isAdminModeActive();
  const memberGuest = session ? await guestOfMember(meal.id, session.member.id) : null;
  const keyGuest = memberGuest ? null : await guestOfKey(meal.id, (await cookies()).get(cookieName(meal))?.value ?? null);
  const actor: Actor = {
    organizer: !!session && (session.member.id === meal.createdById || admin),
    guest: memberGuest ?? keyGuest,
    memberId: session?.member.id ?? null,
  };
  // The club page is for its organizer, its guests, and anyone when it's open; the link is for everyone who has it.
  const allowed = "token" in ref || actor.organizer || !!actor.guest || meal.open;
  return allowed ? { meal, actor, session, admin } : null;
}

/** For the pages: the meal as this visitor sees it, or null (no such meal, or not for them). */
export async function loadMeal(ref: MealRef): Promise<MealView | null> {
  const r = await resolve(ref);
  return r ? getMealView(r.meal, r.actor) : null;
}

