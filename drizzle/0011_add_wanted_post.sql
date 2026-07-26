CREATE TABLE "wanted_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wanted_post_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wanted_interest_wanted_post_id_member_id_unique" UNIQUE("wanted_post_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "wanted_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"needed_by" date,
	"status" text DEFAULT 'open' NOT NULL,
	"group_buy_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanted_interest" ADD CONSTRAINT "wanted_interest_wanted_post_id_wanted_post_id_fk" FOREIGN KEY ("wanted_post_id") REFERENCES "public"."wanted_post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_interest" ADD CONSTRAINT "wanted_interest_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_post" ADD CONSTRAINT "wanted_post_requester_id_member_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;