CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;