CREATE TABLE "post_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"cf_stream_uid" text NOT NULL,
	"display_order" integer NOT NULL,
	"processing_status" text DEFAULT 'processing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_post_id_user_id_idx" ON "post_reactions" USING btree ("post_id","user_id");