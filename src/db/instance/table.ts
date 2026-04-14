// SPDX-License-Identifier: AGPL-3.0-or-later
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const instanceConfig = pgTable("instance_config", {
	id: text("id").primaryKey(),
	familyName: text("family_name").notNull(),
	setupCompleted: boolean("setup_completed").notNull().default(false),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
