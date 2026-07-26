import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/core/db/client";
import { auth } from "./config";

/**
 * Cached per-request: the (club) layout calls this to guard the route group
 * and render the header, then each page calls it again for its own data —
 * React dedupes identical calls within one render pass, so that's one query,
 * not two.
 */
export const getSession = cache(async () => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;

  const member = await db.query.member.findFirst({
    where: (m, { eq }) => eq(m.userId, result.user.id),
  });
  if (!member) return null; // user row exists but member profile hasn't landed yet

  return { user: result.user, member };
});
