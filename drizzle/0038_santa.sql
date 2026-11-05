CREATE TABLE "santa_cohost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "santa_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'preparation' NOT NULL,
	"budget" text DEFAULT '' NOT NULL,
	"exchange_date" date,
	"message" text DEFAULT '' NOT NULL,
	"previous_event_id" uuid,
	"launched_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "santa_event_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "santa_exclusion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"mutual" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "santa_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"member_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"recipient_id" uuid,
	"letter" text DEFAULT '' NOT NULL,
	"letter_notified_at" timestamp with time zone,
	"mail_sent_at" timestamp with time zone,
	"mail_error" text,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "santa_participant_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "santa_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"asker_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "santa_unmask" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "santa_cohost" ADD CONSTRAINT "santa_cohost_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_cohost" ADD CONSTRAINT "santa_cohost_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_event" ADD CONSTRAINT "santa_event_host_member_id_member_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_event" ADD CONSTRAINT "santa_event_previous_event_id_santa_event_id_fk" FOREIGN KEY ("previous_event_id") REFERENCES "public"."santa_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_exclusion" ADD CONSTRAINT "santa_exclusion_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_exclusion" ADD CONSTRAINT "santa_exclusion_from_id_santa_participant_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_exclusion" ADD CONSTRAINT "santa_exclusion_to_id_santa_participant_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_participant" ADD CONSTRAINT "santa_participant_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_participant" ADD CONSTRAINT "santa_participant_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_participant" ADD CONSTRAINT "santa_participant_recipient_id_santa_participant_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."santa_participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_question" ADD CONSTRAINT "santa_question_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_question" ADD CONSTRAINT "santa_question_asker_id_santa_participant_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_question" ADD CONSTRAINT "santa_question_target_id_santa_participant_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_unmask" ADD CONSTRAINT "santa_unmask_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_unmask" ADD CONSTRAINT "santa_unmask_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_unmask" ADD CONSTRAINT "santa_unmask_participant_id_santa_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "santa_cohost_event_member_idx" ON "santa_cohost" USING btree ("event_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "santa_exclusion_pair_idx" ON "santa_exclusion" USING btree ("from_id","to_id");--> statement-breakpoint
CREATE INDEX "santa_participant_event_idx" ON "santa_participant" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "santa_participant_member_idx" ON "santa_participant" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "santa_question_event_idx" ON "santa_question" USING btree ("event_id");