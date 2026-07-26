import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { member } from "./member";

export const notification = pgTable("notification", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id),
  kind: text("kind").notNull(), // e.g. 'invitation.accepted', 'booking.requested'
  entityRef: text("entity_ref"), // free-form pointer, e.g. "member:<uuid>"
  payload: jsonb("payload").notNull().default({}),
  readAt: timestamp("read_at", { withTimezone: true }),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;
