ALTER TABLE "member" ADD COLUMN "calendar_token" text;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_calendar_token_unique" UNIQUE("calendar_token");