CREATE TABLE "don_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "don_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "don_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "don_interest_listing_id_member_id_unique" UNIQUE("listing_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "don_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"photo_path" text,
	"price_text" text,
	"is_free" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"reserved_for_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "don_interest" ADD CONSTRAINT "don_interest_listing_id_don_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."don_listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "don_interest" ADD CONSTRAINT "don_interest_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "don_listing" ADD CONSTRAINT "don_listing_created_by_id_member_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "don_listing" ADD CONSTRAINT "don_listing_category_id_don_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."don_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "don_listing" ADD CONSTRAINT "don_listing_reserved_for_member_id_member_id_fk" FOREIGN KEY ("reserved_for_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "don_category" ("name", "sort") VALUES
	('Bricolage', 0),
	('Jardinage', 10),
	('Ménage', 20),
	('Festif', 30),
	('Jeux de société', 40),
	('Vêtements', 50),
	('Autre', 60);