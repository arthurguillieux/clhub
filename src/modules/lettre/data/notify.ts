import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db/client";
import { letterCohost, member, user, type Letter } from "@/core/db/schema";
import { sendMail } from "@/core/mail/send";
import { SantaNoticeEmail } from "@/core/mail/templates/SantaEmail";
import { createNotification } from "@/core/notifications";
import { wantsEmail } from "@/core/notifications/preferences";
import { de } from "@/modules/santa/words";
import { euros, offerSentence, type OfferEvent } from "../domain/letter";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/**
 * Someone gave, promised or took back: every organizer of the letter hears it in their notifications,
 * and by mail unless they turned that off (Réglages › Notifications). The one who did it is left out.
 * Never fails the action that caused it.
 */
export async function notifyOrganizers(l: Letter, exceptMemberId: string | null, event: OfferEvent & { totalCents?: number; targetCents?: number }): Promise<void> {
  try {
    const cohosts = await db.select({ memberId: letterCohost.memberId }).from(letterCohost).where(eq(letterCohost.letterId, l.id));
    const ids = [l.hostMemberId, ...cohosts.map((c) => c.memberId)].filter((id) => id !== exceptMemberId);
    if (ids.length === 0) return;
    const people = await db
      .select({ id: member.id, notifPrefs: member.notifPrefs, email: user.email })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(inArray(member.id, ids));

    const sentence = offerSentence({ ...event, childName: l.childName });
    const gauge =
      event.amountCents !== null && event.totalCents !== undefined && event.targetCents
        ? ` La cagnotte en est à ${euros(event.totalCents)} sur ${euros(event.targetCents)}.${event.type === "offer" ? " Coche « reçu » sur la page de la lettre quand l'argent arrive." : ""}`
        : "";
    const body = `C'est sur la lettre ${de(l.childName)} au Père Noël, ${l.year}. La liste est déjà à jour pour toute la famille.${gauge}`;

    for (const person of people) {
      await createNotification({
        memberId: person.id,
        kind: `lettre.${event.type}`,
        entityRef: `lettre:${l.code}`,
        payload: { code: l.code, childName: l.childName, giftTitle: event.giftTitle, name: event.name, amountCents: event.amountCents },
      });
      if (!person.email || !wantsEmail(person.notifPrefs, "lettre")) continue;
      try {
        await sendMail({
          to: person.email,
          subject: `${event.type === "offer" ? (event.amountCents !== null ? "💶" : "🎁") : "↩️"} ${sentence.replace(/\.$/, "")}`,
          react: SantaNoticeEmail({ title: `Lettre au Père Noël ${de(l.childName)} ${l.year}`, heading: sentence, body, link: `${appUrl()}/lettre/${l.code}/panneau`, cta: "Voir la lettre", theme: "blanc" }),
          devFallbackMessage: `${person.email}: ${sentence}`,
        });
      } catch (error) {
        console.error("Letter notification mail failed", error);
      }
    }
  } catch (error) {
    console.error("Letter notification failed", error);
  }
}
