CREATE TABLE "mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"comment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
