CREATE TABLE "nye_cohost" (
	"edition_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nye_cohost_edition_id_member_id_pk" PRIMARY KEY("edition_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "nye_cost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"label" text NOT NULL,
	"cents" integer DEFAULT 0 NOT NULL,
	"split" text DEFAULT 'equal' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nye_edition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"place" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"payment_info" text DEFAULT '' NOT NULL,
	"headcount_override" integer,
	"previous_edition_id" uuid,
	"request_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nye_edition_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "nye_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"label" text NOT NULL,
	"cents" integer NOT NULL,
	"cost_id" uuid,
	"list_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nye_guest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"member_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"answer" text DEFAULT 'pending' NOT NULL,
	"days" jsonb,
	"option_id" uuid,
	"diet" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"invited_at" timestamp with time zone,
	"mail_error" text,
	"paid_declared_at" timestamp with time zone,
	"received_cents" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nye_guest_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "nye_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rule" text DEFAULT 'fixed' NOT NULL,
	"ratio" real DEFAULT 1 NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"per_pack" integer DEFAULT 1 NOT NULL,
	"pack_price_cents" integer,
	"stock" real DEFAULT 0 NOT NULL,
	"override_packs" integer,
	"guest_id" uuid,
	"bought" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nye_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"split" text DEFAULT 'presence' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nye_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"day" date NOT NULL,
	"label" text NOT NULL,
	"menu" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nye_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"label" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nye_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"pole" text NOT NULL,
	"title" text NOT NULL,
	"due" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nye_task_guest" (
	"task_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	CONSTRAINT "nye_task_guest_task_id_guest_id_pk" PRIMARY KEY("task_id","guest_id")
);
--> statement-breakpoint
ALTER TABLE "nye_cohost" ADD CONSTRAINT "nye_cohost_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_cohost" ADD CONSTRAINT "nye_cohost_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_cost" ADD CONSTRAINT "nye_cost_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_edition" ADD CONSTRAINT "nye_edition_host_member_id_member_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_edition" ADD CONSTRAINT "nye_edition_previous_edition_id_nye_edition_id_fk" FOREIGN KEY ("previous_edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_expense" ADD CONSTRAINT "nye_expense_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_expense" ADD CONSTRAINT "nye_expense_guest_id_nye_guest_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."nye_guest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_expense" ADD CONSTRAINT "nye_expense_cost_id_nye_cost_id_fk" FOREIGN KEY ("cost_id") REFERENCES "public"."nye_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_expense" ADD CONSTRAINT "nye_expense_list_id_nye_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."nye_list"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_guest" ADD CONSTRAINT "nye_guest_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_guest" ADD CONSTRAINT "nye_guest_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_guest" ADD CONSTRAINT "nye_guest_option_id_nye_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."nye_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_item" ADD CONSTRAINT "nye_item_list_id_nye_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."nye_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_item" ADD CONSTRAINT "nye_item_guest_id_nye_guest_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."nye_guest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_list" ADD CONSTRAINT "nye_list_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_meal" ADD CONSTRAINT "nye_meal_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_option" ADD CONSTRAINT "nye_option_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_task" ADD CONSTRAINT "nye_task_edition_id_nye_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."nye_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_task_guest" ADD CONSTRAINT "nye_task_guest_task_id_nye_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."nye_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nye_task_guest" ADD CONSTRAINT "nye_task_guest_guest_id_nye_guest_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."nye_guest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nye_cost_edition_idx" ON "nye_cost" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "nye_expense_edition_idx" ON "nye_expense" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "nye_guest_edition_idx" ON "nye_guest" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "nye_guest_member_idx" ON "nye_guest" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nye_guest_edition_member_idx" ON "nye_guest" USING btree ("edition_id","member_id");--> statement-breakpoint
CREATE INDEX "nye_item_list_idx" ON "nye_item" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "nye_list_edition_idx" ON "nye_list" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "nye_meal_edition_idx" ON "nye_meal" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "nye_option_edition_idx" ON "nye_option" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "nye_task_edition_idx" ON "nye_task" USING btree ("edition_id");