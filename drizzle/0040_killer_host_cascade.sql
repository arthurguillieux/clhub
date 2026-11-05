ALTER TABLE "killer_game" DROP CONSTRAINT "killer_game_host_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "killer_game" ADD CONSTRAINT "killer_game_host_member_id_member_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;