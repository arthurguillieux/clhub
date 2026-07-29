CREATE TABLE "server_error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text,
	"method" text,
	"route_type" text,
	"message" text NOT NULL,
	"stack" text,
	"digest" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
