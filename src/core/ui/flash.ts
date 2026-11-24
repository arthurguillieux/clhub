import { cookies } from "next/headers";

/** The cookie the club's Toaster reads once, then deletes (readable by the page on purpose: it only carries a sentence). */
export const FLASH_COOKIE = "clhub_flash";

/**
 * A short confirmation for the next page, after an action that moves you elsewhere (« Objet ajouté »).
 * Call it just before `redirect()`; the Toaster in the club layout shows it for a few seconds.
 */
export async function flash(message: string): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(message), { path: "/", maxAge: 60, sameSite: "lax", httpOnly: false });
}
