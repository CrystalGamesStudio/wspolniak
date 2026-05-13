CREATE TABLE "post_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"cf_stream_uid" text NOT NULL,
	"display_order" integer NOT NULL,
	"processing_status" text DEFAULT 'processing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
