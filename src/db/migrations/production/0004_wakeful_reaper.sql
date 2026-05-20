CREATE TABLE "user_bans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"banned_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "post_videos" CASCADE;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;