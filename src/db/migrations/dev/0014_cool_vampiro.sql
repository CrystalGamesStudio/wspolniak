CREATE TABLE "pinned_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"pinned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pinned_posts_post_id_idx" ON "pinned_posts" USING btree ("post_id");