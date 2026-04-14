// SPDX-License-Identifier: AGPL-3.0-or-later
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pushSubscriptions = pgTable("push_subscriptions", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	endpoint: text("endpoint").notNull().unique(),
	p256dh: text("p256dh").notNull(),
	auth: text("auth").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
