CREATE TABLE "killer_game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "killer_game_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "killer_kill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"victim_id" uuid NOT NULL,
	"killer_id" uuid NOT NULL,
	"inherited_target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "killer_player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mission" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"token" text,
	"photo" "bytea",
	"photo_version" integer DEFAULT 0 NOT NULL,
	"target_id" uuid,
	"alive" boolean DEFAULT true NOT NULL,
	"killed_at" timestamp with time zone,
	"killed_by_id" uuid,
	"joined_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "killer_game" ADD CONSTRAINT "killer_game_host_member_id_member_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "killer_kill" ADD CONSTRAINT "killer_kill_game_id_killer_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."killer_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "killer_player" ADD CONSTRAINT "killer_player_game_id_killer_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."killer_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "killer_player_game_idx" ON "killer_player" USING btree ("game_id");