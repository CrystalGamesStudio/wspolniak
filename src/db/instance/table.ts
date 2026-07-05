// SPDX-License-Identifier: AGPL-3.0-or-later
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const instanceConfig = pgTable("instance_config", {
	id: text("id").primaryKey(),
	familyName: text("family_name").notNull(),
	setupCompleted: boolean("setup_completed").notNull().default(false),
	shareCode: text("share_code"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	maintenanceMode: boolean("maintenance_mode").notNull().default(false),
	maintenanceMessage: text("maintenance_message"),
	maintenanceSubtitle: text("maintenance_subtitle"),
	maintenanceIcon: text("maintenance_icon"),
});
