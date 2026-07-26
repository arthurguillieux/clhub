import { headers } from "next/headers";
import { db } from "@/core/db/client";
import { auth } from "./config";

export async function getSession() {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;

  const member = await db.query.member.findFirst({
    where: (m, { eq }) => eq(m.userId, result.user.id),
  });
  if (!member) return null; // user row exists but member profile hasn't landed yet

  return { user: result.user, member };
}
