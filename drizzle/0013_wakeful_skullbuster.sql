CREATE TABLE "item_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "item_unit" ADD CONSTRAINT "item_unit_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Every existing item becomes exactly one unit — `quantity` was never
-- surfaced in any form, so no item has ever actually behaved as more than
-- one bookable copy. Owners add further units afterward if they need to.
INSERT INTO "item_unit" ("item_id")
SELECT "id" FROM "item";
--> statement-breakpoint

ALTER TABLE "booking" ADD COLUMN "unit_id" uuid;
--> statement-breakpoint

-- Exactly one unit per item at this point, so this join is unambiguous.
UPDATE "booking" b
SET "unit_id" = u."id"
FROM "item_unit" u
WHERE u."item_id" = b."item_id";
--> statement-breakpoint

ALTER TABLE "booking" ALTER COLUMN "unit_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_unit_id_item_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."item_unit"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "item" DROP COLUMN "quantity";
--> statement-breakpoint

-- Availability (ADR-004) moves from "one slot per item" to "one slot per
-- unit" — the exclusion constraint that makes double-booking physically
-- impossible follows the same move, from (item_id, daterange) to
-- (unit_id, daterange). Two different trestles of the same item can now be
-- booked for overlapping dates; the same trestle still can't.
ALTER TABLE "booking" DROP CONSTRAINT "booking_no_overlap";
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap"
	EXCLUDE USING gist (
		unit_id WITH =,
		daterange(start_date, end_date, '[]') WITH &&
	) WHERE (status IN ('approved', 'active'));
