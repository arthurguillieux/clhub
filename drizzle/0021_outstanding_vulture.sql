CREATE TABLE "recipe_review" (
	"recipe_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_review_recipe_id_member_id_pk" PRIMARY KEY("recipe_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "equipment" text;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "prep_minutes" integer;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "cook_minutes" integer;--> statement-breakpoint
ALTER TABLE "recipe_review" ADD CONSTRAINT "recipe_review_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_review" ADD CONSTRAINT "recipe_review_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;