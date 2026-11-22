CREATE TABLE "wolf_card_art" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"face" text NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wolf_game" ADD COLUMN "reveal" jsonb;--> statement-breakpoint
ALTER TABLE "wolf_player" ADD COLUMN "usual_position" integer;--> statement-breakpoint
ALTER TABLE "wolf_card_art" ADD CONSTRAINT "wolf_card_art_owner_member_id_member_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wolf_card_art_owner_face_idx" ON "wolf_card_art" USING btree ("owner_member_id","face");