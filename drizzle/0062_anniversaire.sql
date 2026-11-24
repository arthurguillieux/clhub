CREATE TABLE "birthday" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"honoree_member_id" uuid,
	"honoree_name" text NOT NULL,
	"event_date" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"chosen_idea_id" uuid,
	"buyer_member_id" uuid,
	"price_cents" integer,
	"bought_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_idea" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"birthday_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"price_cents" integer,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_participant" (
	"birthday_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"answer" text DEFAULT 'pending' NOT NULL,
	"invited_by_id" uuid,
	"repaid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "birthday_participant_birthday_id_member_id_pk" PRIMARY KEY("birthday_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "birthday_vote" (
	"idea_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "birthday_vote_idea_id_member_id_pk" PRIMARY KEY("idea_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "birthday" ADD CONSTRAINT "birthday_created_by_id_member_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday" ADD CONSTRAINT "birthday_honoree_member_id_member_id_fk" FOREIGN KEY ("honoree_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday" ADD CONSTRAINT "birthday_buyer_member_id_member_id_fk" FOREIGN KEY ("buyer_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_idea" ADD CONSTRAINT "birthday_idea_birthday_id_birthday_id_fk" FOREIGN KEY ("birthday_id") REFERENCES "public"."birthday"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_idea" ADD CONSTRAINT "birthday_idea_author_id_member_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_participant" ADD CONSTRAINT "birthday_participant_birthday_id_birthday_id_fk" FOREIGN KEY ("birthday_id") REFERENCES "public"."birthday"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_participant" ADD CONSTRAINT "birthday_participant_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_participant" ADD CONSTRAINT "birthday_participant_invited_by_id_member_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_vote" ADD CONSTRAINT "birthday_vote_idea_id_birthday_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."birthday_idea"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_vote" ADD CONSTRAINT "birthday_vote_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "birthday_honoree_idx" ON "birthday" USING btree ("honoree_member_id");--> statement-breakpoint
CREATE INDEX "birthday_idea_birthday_idx" ON "birthday_idea" USING btree ("birthday_id");--> statement-breakpoint
CREATE INDEX "birthday_participant_member_idx" ON "birthday_participant" USING btree ("member_id");