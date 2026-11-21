CREATE TABLE "wolf_game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"token" text NOT NULL,
	"host_member_id" uuid NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"deal_mode" text DEFAULT 'cards' NOT NULL,
	"deck" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plague" boolean DEFAULT true NOT NULL,
	"night_order" jsonb,
	"state" jsonb,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"winner" text,
	"black_plague" boolean DEFAULT false NOT NULL,
	"previous_game_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "wolf_game_code_unique" UNIQUE("code"),
	CONSTRAINT "wolf_game_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "wolf_player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wolf_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wolf_seat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" text,
	"start_role" text,
	"alive" boolean DEFAULT true NOT NULL,
	"died_turn" integer,
	"death_order" integer,
	"death_cause" text,
	"claim_key" text,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "wolf_game" ADD CONSTRAINT "wolf_game_host_member_id_member_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wolf_game" ADD CONSTRAINT "wolf_game_previous_game_id_wolf_game_id_fk" FOREIGN KEY ("previous_game_id") REFERENCES "public"."wolf_game"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wolf_player" ADD CONSTRAINT "wolf_player_owner_member_id_member_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wolf_player" ADD CONSTRAINT "wolf_player_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wolf_rule" ADD CONSTRAINT "wolf_rule_owner_member_id_member_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wolf_seat" ADD CONSTRAINT "wolf_seat_game_id_wolf_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."wolf_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wolf_seat" ADD CONSTRAINT "wolf_seat_player_id_wolf_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."wolf_player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wolf_player_owner_name_idx" ON "wolf_player" USING btree ("owner_member_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "wolf_rule_owner_role_idx" ON "wolf_rule" USING btree ("owner_member_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wolf_seat_game_player_idx" ON "wolf_seat" USING btree ("game_id","player_id");