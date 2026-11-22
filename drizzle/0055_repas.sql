CREATE TABLE "meal_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"quantity" numeric(10, 2),
	"bought" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_guest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"member_id" uuid,
	"name" text NOT NULL,
	"status" text,
	"plus_ones" integer DEFAULT 0 NOT NULL,
	"vege" boolean,
	"claim_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"quantity" numeric(10, 2),
	"unit" text,
	"category" text DEFAULT 'manger' NOT NULL,
	"added_by_guest_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_event" ADD COLUMN "token" text;--> statement-breakpoint
ALTER TABLE "menu_event" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "menu_event" ADD COLUMN "time" text;--> statement-breakpoint
ALTER TABLE "menu_event" ADD COLUMN "open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_event" ADD COLUMN "template" text;--> statement-breakpoint
ALTER TABLE "menu_event" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "menu_event" ADD COLUMN "caisse_event_id" uuid;--> statement-breakpoint
ALTER TABLE "meal_claim" ADD CONSTRAINT "meal_claim_item_id_meal_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."meal_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_claim" ADD CONSTRAINT "meal_claim_guest_id_meal_guest_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."meal_guest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_guest" ADD CONSTRAINT "meal_guest_event_id_menu_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."menu_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_guest" ADD CONSTRAINT "meal_guest_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_item" ADD CONSTRAINT "meal_item_event_id_menu_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."menu_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_item" ADD CONSTRAINT "meal_item_added_by_guest_id_meal_guest_id_fk" FOREIGN KEY ("added_by_guest_id") REFERENCES "public"."meal_guest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meal_claim_item_guest_idx" ON "meal_claim" USING btree ("item_id","guest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_guest_event_member_idx" ON "meal_guest" USING btree ("event_id","member_id");--> statement-breakpoint
ALTER TABLE "menu_event" ADD CONSTRAINT "menu_event_token_unique" UNIQUE("token");--> statement-breakpoint
-- The meals of « Les menus du club » become « Les repas du CLHUB »: each gets its link, stays open to
-- the whole club as before, its creator and those who answered become its guests, and what they
-- said they would bring becomes a line of the list, taken by them.
UPDATE "menu_event" SET "token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), "open" = true WHERE "token" IS NULL;--> statement-breakpoint
INSERT INTO "meal_guest" ("event_id", "member_id", "name", "status")
SELECT e."id", e."created_by_id", u."name", 'yes' FROM "menu_event" e JOIN "member" m ON m."id" = e."created_by_id" JOIN "user" u ON u."id" = m."user_id"
ON CONFLICT ("event_id", "member_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "meal_guest" ("event_id", "member_id", "name", "status")
SELECT r."event_id", r."member_id", u."name", CASE WHEN r."attending" THEN 'yes' ELSE 'no' END FROM "menu_response" r JOIN "member" m ON m."id" = r."member_id" JOIN "user" u ON u."id" = m."user_id"
ON CONFLICT ("event_id", "member_id") DO UPDATE SET "status" = EXCLUDED."status";--> statement-breakpoint
INSERT INTO "meal_item" ("event_id", "label", "category", "added_by_guest_id")
SELECT r."event_id", left(r."bringing", 120), 'manger', g."id" FROM "menu_response" r JOIN "meal_guest" g ON g."event_id" = r."event_id" AND g."member_id" = r."member_id"
WHERE r."bringing" IS NOT NULL AND btrim(r."bringing") <> '';--> statement-breakpoint
INSERT INTO "meal_claim" ("item_id", "guest_id") SELECT i."id", i."added_by_guest_id" FROM "meal_item" i WHERE i."added_by_guest_id" IS NOT NULL;
