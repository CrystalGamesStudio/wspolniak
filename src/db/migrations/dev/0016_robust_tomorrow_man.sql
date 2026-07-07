CREATE TABLE "push_delivery_events" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"user_id" text NOT NULL,
	"outcome" text NOT NULL,
	"status_code" integer,
	"trigger_kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "push_delivery_events_created_at_idx" ON "push_delivery_events" USING btree ("created_at" DESC NULLS LAST);