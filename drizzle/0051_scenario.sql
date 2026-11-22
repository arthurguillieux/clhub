CREATE TABLE "scenario_action" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"action" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_cohost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"member_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"token" text NOT NULL,
	"scenario_id" text NOT NULL,
	"host_member_id" uuid NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"setup" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"projection_seen_at" timestamp with time zone,
	"media_ready" integer DEFAULT 0 NOT NULL,
	"media_total" integer DEFAULT 0 NOT NULL,
	"mic_ready" boolean DEFAULT false NOT NULL,
	"previous_game_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "scenario_game_code_unique" UNIQUE("code"),
	CONSTRAINT "scenario_game_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "scenario_unlock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"scenario_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenario_action" ADD CONSTRAINT "scenario_action_game_id_scenario_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."scenario_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_cohost" ADD CONSTRAINT "scenario_cohost_game_id_scenario_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."scenario_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_cohost" ADD CONSTRAINT "scenario_cohost_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_game" ADD CONSTRAINT "scenario_game_host_member_id_member_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_game" ADD CONSTRAINT "scenario_game_previous_game_id_scenario_game_id_fk" FOREIGN KEY ("previous_game_id") REFERENCES "public"."scenario_game"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_unlock" ADD CONSTRAINT "scenario_unlock_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scenario_action_game_idx" ON "scenario_action" USING btree ("game_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_cohost_game_member_idx" ON "scenario_cohost" USING btree ("game_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_unlock_member_idx" ON "scenario_unlock" USING btree ("member_id","scenario_id");