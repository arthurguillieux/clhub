CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_number" integer,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_path" text,
	"bio" text,
	"phone" text,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_id" uuid,
	"notif_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_member_number_unique" UNIQUE("member_number"),
	CONSTRAINT "member_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_invited_by_id_member_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;