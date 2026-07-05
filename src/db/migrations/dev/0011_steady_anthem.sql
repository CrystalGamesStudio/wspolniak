ALTER TABLE "instance_config" ADD COLUMN "maintenance_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "maintenance_message" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "maintenance_subtitle" text;--> statement-breakpoint
ALTER TABLE "instance_config" ADD COLUMN "maintenance_icon" text;