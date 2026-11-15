CREATE TABLE "letter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"token" text NOT NULL,
	"host_member_id" uuid NOT NULL,
	"child_name" text NOT NULL,
	"year" integer NOT NULL,
	"words" text DEFAULT '' NOT NULL,
	"advice" text DEFAULT '' NOT NULL,
	"pay_note" text DEFAULT '' NOT NULL,
	"photo_id" uuid,
	"thanks_text" text DEFAULT '' NOT NULL,
	"thanks_photo_id" uuid,
	"thanks_at" timestamp with time zone,
	"cohost_password" text,
	"previous_letter_id" uuid,
	"shared_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "letter_code_unique" UNIQUE("code"),
	CONSTRAINT "letter_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "letter_cohost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letter_gift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"price_cents" integer,
	"note" text DEFAULT '' NOT NULL,
	"second_hand" boolean DEFAULT false NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"copies" integer DEFAULT 1,
	"pot" boolean DEFAULT false NOT NULL,
	"photo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letter_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" uuid NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letter_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" uuid NOT NULL,
	"gift_id" uuid NOT NULL,
	"name" text NOT NULL,
	"visitor_key" text,
	"amount_cents" integer,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "letter" ADD CONSTRAINT "letter_host_member_id_member_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter" ADD CONSTRAINT "letter_photo_id_letter_image_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."letter_image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter" ADD CONSTRAINT "letter_thanks_photo_id_letter_image_id_fk" FOREIGN KEY ("thanks_photo_id") REFERENCES "public"."letter_image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter" ADD CONSTRAINT "letter_previous_letter_id_letter_id_fk" FOREIGN KEY ("previous_letter_id") REFERENCES "public"."letter"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_cohost" ADD CONSTRAINT "letter_cohost_letter_id_letter_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_cohost" ADD CONSTRAINT "letter_cohost_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_gift" ADD CONSTRAINT "letter_gift_letter_id_letter_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_gift" ADD CONSTRAINT "letter_gift_photo_id_letter_image_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."letter_image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_image" ADD CONSTRAINT "letter_image_letter_id_letter_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_offer" ADD CONSTRAINT "letter_offer_letter_id_letter_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_offer" ADD CONSTRAINT "letter_offer_gift_id_letter_gift_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."letter_gift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "letter_cohost_letter_member_idx" ON "letter_cohost" USING btree ("letter_id","member_id");--> statement-breakpoint
CREATE INDEX "letter_gift_letter_idx" ON "letter_gift" USING btree ("letter_id");--> statement-breakpoint
CREATE INDEX "letter_image_letter_idx" ON "letter_image" USING btree ("letter_id");--> statement-breakpoint
CREATE INDEX "letter_offer_gift_idx" ON "letter_offer" USING btree ("gift_id");--> statement-breakpoint
CREATE INDEX "letter_offer_letter_idx" ON "letter_offer" USING btree ("letter_id");