CREATE TABLE "killer_cohost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "killer_cohost" ADD CONSTRAINT "killer_cohost_game_id_killer_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."killer_game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "killer_cohost" ADD CONSTRAINT "killer_cohost_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "killer_cohost_game_member_idx" ON "killer_cohost" USING btree ("game_id","member_id");