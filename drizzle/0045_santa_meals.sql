CREATE TABLE "santa_dish" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"meal_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"with_id" uuid,
	"what" text NOT NULL,
	"category" text NOT NULL,
	"parts" integer,
	"veg" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"idea" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "santa_drink" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit" text NOT NULL,
	"what" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "santa_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"day" date NOT NULL,
	"meal" text NOT NULL,
	"off" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "santa_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "santa_event" ADD COLUMN "meals_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_event" ADD COLUMN "meals_from" date;--> statement-breakpoint
ALTER TABLE "santa_event" ADD COLUMN "meals_to" date;--> statement-breakpoint
ALTER TABLE "santa_event" ADD COLUMN "meals_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_participant" ADD COLUMN "diet" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_participant" ADD COLUMN "guests" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_dish" ADD CONSTRAINT "santa_dish_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_dish" ADD CONSTRAINT "santa_dish_meal_id_santa_meal_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."santa_meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_dish" ADD CONSTRAINT "santa_dish_participant_id_santa_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_dish" ADD CONSTRAINT "santa_dish_with_id_santa_participant_id_fk" FOREIGN KEY ("with_id") REFERENCES "public"."santa_participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_drink" ADD CONSTRAINT "santa_drink_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_drink" ADD CONSTRAINT "santa_drink_participant_id_santa_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_meal" ADD CONSTRAINT "santa_meal_event_id_santa_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."santa_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_presence" ADD CONSTRAINT "santa_presence_meal_id_santa_meal_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."santa_meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_presence" ADD CONSTRAINT "santa_presence_participant_id_santa_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."santa_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "santa_dish_event_idx" ON "santa_dish" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "santa_drink_event_idx" ON "santa_drink" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "santa_meal_slot_idx" ON "santa_meal" USING btree ("event_id","day","meal");--> statement-breakpoint
CREATE UNIQUE INDEX "santa_presence_idx" ON "santa_presence" USING btree ("meal_id","participant_id");