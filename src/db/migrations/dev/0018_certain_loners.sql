ALTER TABLE "instance_config" ADD COLUMN "youtube_channel_id" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "youtube_channel_title" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "youtube_refresh_token" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "youtube_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "youtube_connected_by" text;