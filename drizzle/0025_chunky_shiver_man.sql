ALTER TABLE "member" ADD COLUMN "dietary_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "dietary_notes" text;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "dietary_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;