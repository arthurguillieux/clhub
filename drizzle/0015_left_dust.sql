CREATE TABLE "menu_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_response" (
	"event_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"attending" boolean NOT NULL,
	"bringing" text,
	"allergies" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_response_event_id_member_id_pk" PRIMARY KEY("event_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "menu_event" ADD CONSTRAINT "menu_event_created_by_id_member_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_response" ADD CONSTRAINT "menu_response_event_id_menu_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."menu_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_response" ADD CONSTRAINT "menu_response_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;