ALTER TABLE "user_bans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "user_bans" CASCADE;--> statement-breakpoint
DROP INDEX "post_reactions_post_id_user_id_idx";--> statement-breakpoint
ALTER TABLE "post_reactions" ADD COLUMN "comment_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_comment_id_user_id_idx" ON "post_reactions" USING btree ("comment_id","user_id") WHERE "post_reactions"."comment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_post_id_user_id_idx" ON "post_reactions" USING btree ("post_id","user_id") WHERE "post_reactions"."comment_id" is null;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "note";