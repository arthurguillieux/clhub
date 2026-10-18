ALTER TABLE "killer_game" ADD COLUMN "sound" "bytea";--> statement-breakpoint
ALTER TABLE "killer_game" ADD COLUMN "sound_type" text;--> statement-breakpoint
ALTER TABLE "killer_game" ADD COLUMN "sound_version" integer DEFAULT 0 NOT NULL;