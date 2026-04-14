// SPDX-License-Identifier: AGPL-3.0-or-later
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const comments = pgTable("comments", {
	id: text("id").primaryKey(),
	postId: text("post_id").notNull(),
	authorId: text("author_id").notNull(),
	body: text("body").notNull(),
	deletedAt: timestamp("deleted_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
