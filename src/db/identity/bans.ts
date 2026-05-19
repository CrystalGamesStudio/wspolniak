// SPDX-License-Identifier: AGPL-3.0-or-later
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./table";

export const userBans = pgTable("user_bans", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	bannedBy: text("banned_by")
		.notNull()
		.references(() => users.id),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
