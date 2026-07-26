CREATE TABLE "item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"brand" text,
	"model" text,
	"product_url" text,
	"price_cents" integer,
	"replacement_value_cents" integer,
	"condition" text DEFAULT 'bon' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"accessories" text,
	"consumables" text,
	"safety_notes" text,
	"pickup_location" text,
	"pickup_notes" text,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"max_loan_days" integer,
	"buffer_days" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "item_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_slot" text,
	"end_slot" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"owner_note" text,
	"responded_at" timestamp with time zone,
	"responded_by" uuid,
	"picked_up_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"return_condition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_borrower_id_member_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_responded_by_member_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Makes double-booking a single item physically impossible, even under
-- concurrent requests — the application check in canBook() is a courtesy
-- (a clear error message), this is the actual guarantee. Pending requests
-- are deliberately excluded (ADR-006): only confirmed or in-progress loans
-- block a date range.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap"
	EXCLUDE USING gist (
		item_id WITH =,
		daterange(start_date, end_date, '[]') WITH &&
	) WHERE (status IN ('approved', 'active'));