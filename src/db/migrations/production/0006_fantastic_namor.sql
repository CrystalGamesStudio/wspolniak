CREATE TABLE "mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"comment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinned_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"pinned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
DROP INDEX "post_reactions_post_id_user_id_idx";--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "maintenance_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "maintenance_message" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "maintenance_subtitle" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "maintenance_icon" text;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD COLUMN "comment_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "pinned_posts_post_id_idx" ON "pinned_posts" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "push_delivery_events_created_at_idx" ON "push_delivery_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_comment_id_user_id_idx" ON "post_reactions" USING btree ("comment_id","user_id") WHERE "post_reactions"."comment_id" is not null;--> statement-breakpoint
CREATE INDEX "posts_created_at_id_idx" ON "posts" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_author_id_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_post_id_user_id_idx" ON "post_reactions" USING btree ("post_id","user_id") WHERE "post_reactions"."comment_id" is null;