CREATE TABLE "instance_config" (
	"id" text PRIMARY KEY NOT NULL,
	"family_name" text NOT NULL,
	"setup_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_token_hash_unique" UNIQUE("token_hash")
);
