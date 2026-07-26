CREATE TABLE "achievement" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"hint" text,
	"icon" text NOT NULL,
	"secret" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_achievement" (
	"member_id" uuid NOT NULL,
	"achievement_key" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"progress" jsonb,
	CONSTRAINT "member_achievement_member_id_achievement_key_pk" PRIMARY KEY("member_id","achievement_key")
);
--> statement-breakpoint
ALTER TABLE "member_achievement" ADD CONSTRAINT "member_achievement_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_achievement" ADD CONSTRAINT "member_achievement_achievement_key_achievement_key_fk" FOREIGN KEY ("achievement_key") REFERENCES "public"."achievement"("key") ON DELETE no action ON UPDATE no action;