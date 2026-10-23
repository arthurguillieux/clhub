ALTER TABLE "killer_game" ADD COLUMN "countdown_sound" "bytea";--> statement-breakpoint
ALTER TABLE "killer_game" ADD COLUMN "countdown_sound_type" text;--> statement-breakpoint
ALTER TABLE "killer_game" ADD COLUMN "countdown_sound_version" integer DEFAULT 0 NOT NULL;